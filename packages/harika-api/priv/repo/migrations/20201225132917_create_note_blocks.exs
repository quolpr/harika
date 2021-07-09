defmodule Harika.Repo.Migrations.CreateNoteBlocks do
  use Ecto.Migration

  def change do
    create table(:note_blocks, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :order_position, :integer
      add :content, :text
      add :created_at, :utc_datetime_usec
      add :updated_at, :utc_datetime_usec
      add :created_at_server, :utc_datetime_usec
      add :updated_at_server, :utc_datetime_usec
      add :deleted_at_server, :utc_datetime_usec
      add :version, :bigint, default: fragment("nextval('version_seq')")
      add :version_created, :bigint, default: fragment("nextval('version_seq')")
      add :push_id, :integer

      add :parent_block_id, references(:note_blocks, on_delete: :delete_all, type: :binary_id)
      add :note_id, references(:notes, on_delete: :delete_all, type: :binary_id), null: false
    end
  end
end
