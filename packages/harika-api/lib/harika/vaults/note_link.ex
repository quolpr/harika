defmodule Harika.Vaults.NoteLink do
  use Ecto.Schema
  import Ecto.Changeset

  alias Harika.Vaults.Note
  alias Harika.Vaults.NoteBlock

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "note_links" do
    belongs_to :note, Note
    belongs_to :note_block, NoteBlock

    field :created_at_server, :utc_datetime_usec
    field :deleted_at_server, :utc_datetime_usec
    field :push_id, :integer
    field :updated_at_server, :utc_datetime_usec
    field :version, :integer
    field :version_created, :integer

    field :created_at, :utc_datetime_usec
    field :updated_at, :utc_datetime_usec
  end

  @doc false
  def changeset(notes_link, attrs) do
    notes_link
    |> cast(attrs, [
      :created_at,
      :updated_at,
      :created_at_server,
      :updated_at_server,
      :deleted_at_server,
      :version,
      :version_created,
      :push_id
    ])
    |> validate_required([
      :created_at,
      :updated_at,
      :created_at_server,
      :updated_at_server,
      :deleted_at_server,
      :version,
      :version_created,
      :push_id
    ])
  end
end
