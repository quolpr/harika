defmodule Harika.Repo.Migrations.CreateNotes do
  use Ecto.Migration

  def change do
    create table(:notes, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :title, :text, null: false
      add :daily_note_date, :utc_datetime_usec
      add :created_at, :utc_datetime_usec
      add :updated_at, :utc_datetime_usec
      add :push_id, :integer
      add :created_at_server, :utc_datetime_usec
      add :updated_at_server, :utc_datetime_usec
      add :deleted_at_server, :utc_datetime_usec
      add :version, :bigint, default: fragment("nextval('version_seq')")
      add :version_created, :bigint, default: fragment("nextval('version_seq')")

      add :vault_id, references(:vaults, on_delete: :delete_all, type: :binary_id), null: false
    end
  end
end

