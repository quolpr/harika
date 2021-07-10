defmodule Harika.Syncher.Migrations.CreateChangesTable do
  use Ecto.Migration

  def change do
    create_query = "CREATE TYPE change_type AS ENUM ('create', 'update', 'delete')"
    drop_query = "DROP TYPE change_type"

    execute(create_query, drop_query)

    create table(:sync_db_changes, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:db_name, :string)
      add(:table, :string)
      add(:key, :binary_id)
      add(:type, :change_type)
      add(:rev, :bigint, null: false)
      add(:recieved_from_client_id, :binary_id)

      # on update
      add(:from, :map)
      add(:to, :map)

      # on change
      add(:obj, :map)

      add(:created_at, :utc_datetime_usec)
      add(:updated_at, :utc_datetime_usec)
    end

    create(index("sync_db_changes", [:recieved_from_client_id]))
    create(index("sync_db_changes", ["rev ASC", :db_name]))

    execute("""
      create function assign_rev_id() returns trigger as $$
        begin
          execute format('create IF NOT EXISTS sequence rev_%s_seq', new.db_name);
          new.rev = nextval(format('rev_%s_seq', new.db_name));
          return new;
        end
      $$ language plpgsql;

      create trigger assign_rev_id before insert on sync_db_changes
        for each row execute procedure assign_rev_id();
    """)
  end
end
