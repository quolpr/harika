defmodule Harika.Vaults.Note do
  use Ecto.Schema
  import Ecto.Changeset

  alias Harika.Vaults.NoteBlock
  alias Harika.Vaults.Vault

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "notes" do
    has_many :note_blocks, NoteBlock
    belongs_to :vault, Vault

    field :daily_note_date, :utc_datetime_usec
    field :title, :string

    field :push_id, :integer
    field :version, :integer
    field :version_created, :integer
    field :created_at_server, :utc_datetime_usec
    field :updated_at_server, :utc_datetime_usec
    field :deleted_at_server, :utc_datetime_usec

    field :created_at, :utc_datetime_usec
    field :updated_at, :utc_datetime_usec
  end

  @doc false
  def changeset(note, attrs) do
    note
    |> cast(attrs, [
      :title,
      :child_block_ids,
      :daily_note_date,
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
      :title,
      :child_block_ids,
      :daily_note_date,
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
