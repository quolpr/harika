defmodule Harika.Vaults.Vault do
  use Ecto.Schema
  import Ecto.Changeset

  alias Harika.Accounts.User

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "vaults" do
    belongs_to :user, User

    field :name, :string

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
  def changeset(notes_vault, attrs) do
    notes_vault
    |> cast(attrs, [
      :name,
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
      :name,
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
