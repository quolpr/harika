defmodule Harika.Vaults.NoteBlock do
  use Ecto.Schema
  import Ecto.Changeset

  alias Harika.Vaults.Note
  alias __MODULE__

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "note_blocks" do
    belongs_to :note, Note
    belongs_to :parent_block, NoteBlock

    field :content, :string
    field :order_position, :integer

    field :created_at, :utc_datetime_usec
    field :updated_at, :utc_datetime_usec

    field :created_at_server, :utc_datetime_usec
    field :updated_at_server, :utc_datetime_usec
    field :deleted_at_server, :utc_datetime_usec

    field :push_id, :integer
    field :version, :integer
    field :version_created, :integer
  end

  @doc false
  def changeset(note_block, attrs) do
    note_block
    |> cast(attrs, [
      :parent_block_id,
      :child_block_ids,
      :note_id,
      :content,
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
      :parent_block_id,
      :child_block_ids,
      :note_id,
      :content,
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
