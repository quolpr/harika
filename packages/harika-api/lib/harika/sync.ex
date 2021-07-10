defmodule Harika.Sync do
  import Ecto.Query
  alias Harika.Repo
  alias Harika.Sync.DbChange
  alias Harika.Sync.DbManager

  def create_db_for_user_id(user_id) do
    DbManager.create_user_database_schema(user_id)
  end

  def get_changes(db_name, user_id, client_id, from_revision) do
    prefix = DbManager.get_prefix_for_user_id(user_id)

    %{ids: ids, max_rev: max_rev} =
      from(m in DbChange,
        select: %{
          ids: fragment("ARRAY_AGG(distinct ?)", m.id),
          max_rev: fragment("MAX(distinct ?)", m.rev)
        },
        where: m.rev > ^from_revision,
        where: m.db_name == ^db_name,
        order_by: m.rev
      )
      |> Repo.one(prefix: prefix)

    changes =
      from(m in DbChange,
        where: m.id in ^ids,
        where: m.recieved_from_client_id != ^client_id
      )
      |> Repo.all(prefix: prefix)

    %{max_rev: max_rev, changes: changes}
  end
end
