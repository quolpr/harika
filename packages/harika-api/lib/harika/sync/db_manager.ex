defmodule Harika.Sync.DbManager do
  alias Ecto.Migration.SchemaMigration
  alias Harika.Sync.Migrations

  def get_prefix_for_user_id(user_id) do
    "customer_#{user_id}"
  end

  def create_user_database_schema(user_id) do
    prefix = get_prefix_for_user_id(user_id)

    config =
      Application.get_env(:harika, Harika.Repo)
      |> Keyword.put(:name, nil)
      |> Keyword.put(:pool_size, 2)
      |> Keyword.put(:migration_default_prefix, prefix)
      |> Keyword.put(:prefix, prefix)
      |> Keyword.delete(:pool)

    ## TODO: span new process
    {:ok, pid} = Harika.Repo.start_link(config)
    Harika.Repo.put_dynamic_repo(pid)

    query = """
    CREATE SCHEMA "#{prefix}"
    """

    Harika.Repo.query(query)
    SchemaMigration.ensure_schema_migrations_table!(Harika.Repo, config)

    migrate_repo(
      prefix: prefix,
      dynamic_repo: pid
    )

    Harika.Repo.stop(1000)
    Harika.Repo.put_dynamic_repo(Harika.Repo)
  end

  def migrate_repo(options \\ []) do
    options = Keyword.put(options, :all, true)

    Ecto.Migrator.run(
      Harika.Repo,
      Migrations.get_migrations(),
      :up,
      options
    )
  end
end
