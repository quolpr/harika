defmodule Harika.Sync.DbChange do
  use Ecto.Schema

  alias Harika.Sync.Schemas.CreateSchema
  alias Harika.Sync.Schemas.UpdateSchema
  alias Harika.Sync.Schemas.DeleteSchema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "sync_db_changes" do
    field :db_name, :string
    field :table, :string
    field :key, Ecto.UUID
    field :type, Ecto.Enum, values: [:create, :update, :delete]
    field :rev, :integer
    field :recieved_from_client_id, Ecto.UUID

    # on update
    field :from, :map
    field :to, :map

    # on change
    field :obj, :map

    field :created_at, :utc_datetime_usec
    field :updated_at, :utc_datetime_usec
  end

  def to_schema(%__MODULE__{} = change) do
    case change.type do
      :create ->
        %CreateSchema{
          table: change.table,
          key: change.key,
          source: change.source,
          obj: change.obj
        }

      :update ->
        %UpdateSchema{
          table: change.table,
          key: change.key,
          source: change.source,
          from: change.from,
          to: change.to
        }

      :delete ->
        %DeleteSchema{
          table: change.table,
          key: change.key,
          source: change.source,
          obj: change.obj
        }
    end
  end
end
