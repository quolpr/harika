defmodule Harika.Syncher.Migrations.CreateChangesTable do
  use Ecto.Migration

  alias Ecto.Migration.Runner

  def change do
    prefix = Runner.prefix()

    create_query = "CREATE TYPE #{prefix}.change_type AS ENUM ('create', 'update', 'delete')"
    drop_query = "DROP TYPE #{prefix}.change_type"

    execute(create_query, drop_query)

    create table(:sync_db_changes, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:db_name, :string, null: false)
      add(:table, :string, null: false)
      add(:key, :string, null: false)
      add(:type, :"#{prefix}.change_type", null: false)
      add(:rev, :bigint, null: false)
      add(:recieved_from_client_id, :binary_id, null: false)

      # on update
      add(:from, :map)
      add(:to, :map)

      # on change
      add(:obj, :map)

      add(:created_at, :utc_datetime_usec, null: false)
    end

    create(index("sync_db_changes", [:recieved_from_client_id]))
    create(index("sync_db_changes", ["rev ASC", :db_name]))

    execute("""
      create function #{prefix}.assign_rev_id() returns trigger as $$
        begin
          execute format('create sequence IF NOT EXISTS  #{prefix}.rev_%s_seq', new.db_name);
          new.rev = nextval(format('#{prefix}.rev_%s_seq', new.db_name));
          return new;
        end
      $$ language plpgsql;

    """)

    execute("""
      create trigger assign_rev_id before insert on #{prefix}.sync_db_changes
        for each row execute procedure #{prefix}.assign_rev_id();
    """)
  end
end
