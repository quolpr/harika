defmodule Harika.Sync do
  import Ecto.Query

  alias Harika.Repo
  alias Harika.Sync.DbChange
  alias Harika.Sync.DbManager

  require Logger

  @spec create_db_for_user_id(String.t()) :: :ok
  def create_db_for_user_id(user_id) do
    DbManager.create_user_database_schema(user_id)
  end

  @spec drop_db_for_user_id(String.t()) :: :ok
  def drop_db_for_user_id(user_id) do
    DbManager.drop_user_database_schema(user_id)
  end

  @spec get_changes(String.t(), String.t(), String.t(), integer() | nil) ::
          %{current_revision: integer() | nil, changes: list(DbChange.t())}
  def get_changes(user_id, db_name, client_id, from_revision) do
    prefix = DbManager.get_prefix_for_user_id(user_id)
    from_revision_where = if(from_revision === nil, do: -1, else: from_revision)

    %{ids: ids, max_rev: max_rev} =
      from(m in DbChange,
        select: %{
          ids: fragment("ARRAY_AGG(?)", m.id),
          max_rev: fragment("MAX(?)", m.rev)
        },
        where: m.rev > ^from_revision_where,
        where: m.db_name == ^db_name
      )
      |> Repo.one(prefix: prefix)

    ids = Enum.map(ids || [], &Ecto.UUID.load!(&1))

    changes =
      from(m in DbChange,
        where: m.id in ^ids,
        where: m.recieved_from_client_id != ^client_id,
        order_by: m.rev
      )
      |> Repo.all(prefix: prefix)

    %{
      current_revision: if(max_rev == nil, do: from_revision, else: max_rev),
      changes: for(ch <- changes, do: DbChange.to_schema(ch))
    }
  end

  @spec get_max_rev(String.t(), String.t()) :: integer()
  def get_max_rev(user_id, db_name) do
    prefix = DbManager.get_prefix_for_user_id(user_id)

    from(m in DbChange,
      select: fragment("MAX(?)", m.rev),
      where: m.db_name == ^db_name
    )
    |> Repo.one(prefix: prefix)
  end

  # Not very performant solution. We should move conflict resolution to server
  @spec apply_changes_with_lock(list(map()), integer() | nil, String.t(), String.t(), String.t()) ::
          {:ok, %{status: :stale_changes}}
          | {:ok, %{status: :success, current_revision: integer()}}
          | {:ok, %{status: :locked}}
          | {:error, any()}
  def apply_changes_with_lock(changes, last_applied_remote_revision, user_id, client_id, db_name) do
    resource = "db_changes_#{db_name}_applying"
    lock_exp_sec = 10

    case Redlock.transaction(resource, lock_exp_sec, fn ->
           max_rev = get_max_rev(user_id, db_name)

           if (last_applied_remote_revision === nil && max_rev !== nil) ||
                (max_rev !== nil && last_applied_remote_revision !== nil &&
                   last_applied_remote_revision < max_rev) do
             Logger.warn(
               "Stale changes, current rev is #{max_rev}, client is #{
                 last_applied_remote_revision
               }"
             )

             {:ok, %{status: :stale_changes}}
           else
             new_rev = apply_changes(changes, user_id, client_id, db_name)

             {:ok, %{status: :success, current_revision: new_rev}}
           end
         end) do
      {:ok, res} ->
        {:ok, res}

      {:error, :lock_failure} ->
        {:ok, %{status: :locked}}

      other ->
        other
    end
  end

  @spec apply_changes(list(map()), String.t(), String.t(), String.t()) :: integer()
  defp apply_changes(changes, user_id, client_id, db_name) do
    prefix = DbManager.get_prefix_for_user_id(user_id)

    changes =
      Enum.map(
        changes,
        &DbChange.to_model!(
          Map.merge(&1, %{
            "recieved_from_client_id" => client_id,
            "db_name" => db_name
          })
        )
      )

    ids = Enum.map(changes, & &1.id)

    Repo.insert_all(DbChange, for(ch <- changes, do: Map.drop(ch, [:__struct__, :__meta__])),
      prefix: prefix,
      # TODO: debug why conflicts happening
      on_conflict: :nothing
    )

    from(m in DbChange,
      select: fragment("MAX(?)", m.rev),
      where: m.db_name == ^db_name,
      where: m.id in ^ids
    )
    |> Repo.one(prefix: prefix)
  end
end
