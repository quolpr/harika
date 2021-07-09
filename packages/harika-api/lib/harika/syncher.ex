defmodule Harika.Syncher do
  # defmacro __using__(model: model, name: name) do
  #   alias Ecto.Multi
  #
  #   quote do
  #     def unquote(:"record_#{name}")(%Multi{} = multi, post_changes, last_pulled_version, push_id) do
  #       multi
  #       |> Multi.run(:check_conflict_posts, fn _, _changes ->
  #         case check_conflict_version_posts(post_changes, last_pulled_version) do
  #           :no_conflict -> {:ok, :no_conflict}
  #           :conflict -> {:error, :conflict}
  #         end
  #       end)
  #       |> record_created_posts(post_changes["created"] |> set_push_id(push_id))
  #       |> record_updated_posts(post_changes["updated"] |> set_push_id(push_id))
  #       |> record_deleted_posts(post_changes["deleted"], push_id)
  #     end
  #   end
  # end
  #
  # # ...
  # def set_push_id(posts, push_id) do
  #   posts
  #   |> Enum.map(fn post -> post |> Map.put("push_id", push_id) end)
  # end
  #
  # # ...
  # def is_just_pushed(_post, push_id) when is_nil(push_id), do: false
  # def is_just_pushed(post, push_id), do: post.push_id == push_id

  import Ecto.Query
  alias Ecto.Multi
  alias Harika.Repo

  def record_entities(
        %Multi{} = multi,
        changes,
        last_pulled_version,
        push_id,
        model,
        map_row,
        authed_subquery
      ) do
    changes = Map.put(changes, "created", changes["created"] || [])
    changes = Map.put(changes, "updated", changes["updated"] || [])
    changes = Map.put(changes, "deleted", changes["deleted"] || [])

    changes = filter_notauthed_changes(changes, model, authed_subquery)

    multi
    |> Multi.run(:"check_#{table_name(model)}_conflict", fn _, _changes ->
      case check_conflict_version(changes, last_pulled_version, model) do
        :no_conflict -> {:ok, :no_conflict}
        :conflict -> {:error, :conflict}
      end
    end)
    |> record_created_entities(changes["created"] |> set_push_id(push_id), model, map_row)
    |> record_updated_entities(changes["updated"] |> set_push_id(push_id), model, map_row)
    |> record_deleted_entities(changes["deleted"], push_id, model)
  end

  defp filter_notauthed_changes(changes, model, authed_subquery) do
    ids = get_ids_from_changes(changes)

    allowed_ids =
      from(m in model,
        join: s in subquery(authed_subquery),
        on: s.id == m.id,
        where: s.id in ^ids,
        select: m.id
      )
      |> Repo.all()

    %{
      "created" => changes["created"],
      "updated" => Enum.filter(changes["updated"], &Enum.member?(allowed_ids, &1["id"])),
      "deleted" => Enum.filter(changes["deleted"], &Enum.member?(allowed_ids, &1))
    }
  end

  defp check_conflict_version(changes, last_pulled_version, model) do
    ids = get_ids_from_changes(changes)

    count =
      model
      |> select([p], count(p.version))
      |> where([p], p.id in ^ids)
      |> where([p], p.version > ^last_pulled_version or p.version_created > ^last_pulled_version)
      |> Repo.one()

    case count do
      0 -> :no_conflict
      _ -> :conflict
    end
  end

  defp record_created_entities(%Multi{} = multi, created_changes, model, map_row),
    do:
      upsert_entities(
        multi,
        :"create_#{table_name(model)}_entities",
        created_changes,
        model,
        map_row
      )

  defp record_updated_entities(%Multi{} = multi, updated_changes, model, map_row),
    do:
      upsert_entities(
        multi,
        :"update_#{table_name(model)}_entities",
        updated_changes,
        model,
        map_row
      )

  defp upsert_entities(%Multi{} = multi, _name, changes, _model, _map_row)
       when length(changes) === 0,
       do: multi

  defp upsert_entities(%Multi{} = multi, name, changes, model, map_row) do
    now = DateTime.utc_now()

    entities =
      changes
      |> Enum.map(fn row ->
        row
        |> Map.put("created_at", (row["created_at"] * 1000) |> DateTime.from_unix!(:microsecond))
        |> Map.put("updated_at", (row["updated_at"] * 1000) |> DateTime.from_unix!(:microsecond))
        |> Map.put("created_at_server", now)
        |> Map.put("updated_at_server", now)
        |> map_row.()
        |> key_to_atom()
      end)

    Multi.insert_all(multi, name, model, entities,
      conflict_target: :id,
      on_conflict:
        {:replace_all_except, [:id, :version_created, :created_at_server, :deleted_at_server]},
      returning: true
    )
  end

  defp key_to_atom(map) do
    Enum.reduce(map, %{}, fn
      {key, value}, acc when is_atom(key) -> Map.put(acc, key, value)
      {key, value}, acc when is_binary(key) -> Map.put(acc, String.to_existing_atom(key), value)
    end)
  end

  defp record_deleted_entities(%Multi{} = multi, deleted_ids, _push_id, _model)
       when is_nil(deleted_ids) or length(deleted_ids) === 0,
       do: multi

  defp record_deleted_entities(%Multi{} = multi, deleted_ids, push_id, model) do
    now = DateTime.utc_now()

    rows = Repo.all(from(m in model, where: m.id in ^deleted_ids))

    Enum.reduce(
      deleted_ids,
      multi,
      fn id, multi ->
        row = Enum.find(rows, &(&1.id === id))

        if model do
          Multi.update(
            multi,
            "delete_#{table_name(model)}_#{id}",
            Ecto.Changeset.change(row, %{id: id, deleted_at_server: now, push_id: push_id})
          )
        else
          multi
        end
      end
    )
  end

  def list_entities_changes(last_pulled_version, push_id, model, authed_subquery) do
    entities_latest =
      from(m in model,
        join: s in subquery(authed_subquery),
        on: s.id == m.id,
        where: m.version_created > ^last_pulled_version or m.version > ^last_pulled_version
      )
      |> Repo.all()

    entities_changes =
      entities_latest
      |> Enum.reject(fn entity -> is_just_pushed(entity, push_id) end)
      |> Enum.group_by(fn entity ->
        cond do
          entity.version_created > last_pulled_version and is_nil(entity.deleted_at_server) ->
            :created

          entity.created_at_server != entity.updated_at_server and
              is_nil(entity.deleted_at_server) ->
            :updated

          not is_nil(entity.deleted_at_server) ->
            :deleted
        end
      end)
      |> Map.update(:created, [], fn entities -> entities end)
      |> Map.update(:updated, [], fn entities -> entities end)
      |> Map.update(:deleted, [], fn entities ->
        entities |> Enum.map(fn entity -> entity.id end)
      end)

    latest_version = find_latest_version(entities_latest)

    %{latest_version: latest_version, changes: entities_changes}
  end

  defp find_latest_version(entities) do
    entities
    |> Enum.flat_map(fn entity -> [entity.version, entity.version_created] end)
    |> Enum.max(fn -> 0 end)
  end

  # ...
  defp set_push_id(entities, push_id) do
    entities
    |> Enum.map(fn entity -> entity |> Map.put("push_id", push_id) end)
  end

  # ...
  defp is_just_pushed(_post, push_id) when is_nil(push_id), do: false
  defp is_just_pushed(entity, push_id), do: entity.push_id == push_id

  defp table_name(model), do: model.__struct__.__meta__.source

  defp get_ids_from_changes(changes) do
    Enum.concat(changes["created"], changes["updated"])
    |> Enum.map(fn entity -> entity["id"] end)
    |> Enum.concat(changes["deleted"])
  end
end
