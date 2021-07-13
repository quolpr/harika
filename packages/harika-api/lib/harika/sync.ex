defmodule Harika.Sync do
  import Ecto.Query
  alias Ecto.Multi
  alias Harika.Repo
  alias Harika.Sync.DbChange
  alias Harika.Sync.DbManager

  def create_db_for_user_id(user_id) do
    DbManager.create_user_database_schema(user_id)
  end

  def drop_db_for_user_id(user_id) do
    DbManager.drop_user_database_schema(user_id)
  end

  def get_changes(user_id, db_name, client_id, from_revision) do
    prefix = DbManager.get_prefix_for_user_id(user_id)

    %{ids: ids, max_rev: max_rev} =
      from(m in DbChange,
        select: %{
          ids: fragment("ARRAY_AGG(?)", m.id),
          max_rev: fragment("MAX(?)", m.rev)
        },
        where: m.rev > ^from_revision,
        where: m.db_name == ^db_name
      )
      |> Repo.one(prefix: prefix)

    ids = Enum.map(ids, &Ecto.UUID.load!(&1))

    changes =
      from(m in DbChange,
        where: m.id in ^ids,
        where: m.recieved_from_client_id != ^client_id,
        order_by: m.rev
      )
      |> Repo.all(prefix: prefix)

    %{max_rev: max_rev, changes: changes}
  end

  def get_max_rev(user_id, db_name) do
    prefix = DbManager.get_prefix_for_user_id(user_id)

    from(m in DbChange,
      select: fragment("MAX(?)", m.rev),
      where: m.db_name == ^db_name
    )
    |> Repo.one(prefix: prefix)
  end

  # Not very performant solution. We should move conflict resolution to server
  def apply_changes_with_lock(changes, last_applied_remote_revision, user_id, client_id, db_name) do
    resource = "db_changes_#{db_name}_applying"
    lock_exp_sec = 10

    case Redlock.transaction(resource, lock_exp_sec, fn ->
           max_rev = get_max_rev(user_id, db_name)

           if (max_rev !== nil && last_applied_remote_revision < get_max_rev(user_id, db_name)) ||
                (last_applied_remote_revision === nil && max_rev !== nil) do
             {:error, %{name: "stale_changes"}}
           else
             new_rev = apply_changes(changes, user_id, client_id, db_name)

             {:ok, %{new_rev: new_rev}}
           end
         end) do
      {:ok, res} ->
        {:ok, res}

      {:error, :lock_failure} ->
        {:error, %{name: "locked"}}

      other ->
        other
    end
  end

  defp apply_changes(changes, user_id, client_id, db_name) do
    prefix = DbManager.get_prefix_for_user_id(user_id)

    changes =
      Enum.map(
        changes,
        &DbChange.to_model!(
          Map.merge(&1, %{
            "id" => Ecto.UUID.generate(),
            "recieved_from_client_id" => client_id,
            "db_name" => db_name
          })
        )
      )

    ids = Enum.map(changes, & &1.id)

    Enum.reduce(changes, Multi.new(), fn entry, multi ->
      Multi.insert(multi, entry.id, entry, prefix: prefix)
    end)
    |> Repo.transaction()

    from(m in DbChange,
      select: fragment("MAX(?)", m.rev),
      where: m.db_name == ^db_name,
      where: m.id in ^ids
    )
    |> Repo.one(prefix: prefix)
  end
end
