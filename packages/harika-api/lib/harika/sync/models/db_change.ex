defmodule Harika.Sync.DbChange do
  use Ecto.Schema
  import Ecto.Changeset

  alias Harika.Sync.Schemas.CreateSchema
  alias Harika.Sync.Schemas.UpdateSchema
  alias Harika.Sync.Schemas.DeleteSchema

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "sync_db_changes" do
    field :db_name, :string
    field :table, :string
    field :key, :string
    field :type, Ecto.Enum, values: [:create, :update, :delete]
    field :rev, :integer
    field :recieved_from_client_id, Ecto.UUID

    # on update
    field :from, :map
    field :to, :map

    # on change
    field :obj, :map

    field :created_at, :utc_datetime_usec
  end

  def changeset(model, params) do
    model
    |> cast(params, [
      :id,
      :db_name,
      :table,
      :key,
      :type,
      :recieved_from_client_id,
      :from,
      :to,
      :obj
    ])
    |> validate_required([:db_name, :table, :key, :type, :recieved_from_client_id])
    |> validate_on_type()
    |> put_created_at()
  end

  defp put_created_at(%Ecto.Changeset{valid?: true} = ch) do
    ch
    |> put_change(:created_at, DateTime.utc_now())
  end

  defp put_created_at(ch), do: ch

  defp validate_on_type(%Ecto.Changeset{valid?: true} = ch) do
    if get_field(ch, :type) === :update do
      ch
      |> validate_required([:from, :to])
    else
      ch
      |> validate_required([:obj])
    end
  end

  defp validate_on_type(ch), do: ch

  def to_model!(params) do
    %Ecto.Changeset{valid?: true} = ch = changeset(%__MODULE__{}, params)

    Ecto.Changeset.apply_changes(ch)
  end

  def to_schema(%__MODULE__{} = change) do
    case change.type do
      :create ->
        %CreateSchema{
          table: change.table,
          key: change.key,
          recieved_from_client_id: change.recieved_from_client_id,
          obj: change.obj
        }

      :update ->
        %UpdateSchema{
          table: change.table,
          key: change.key,
          recieved_from_client_id: change.recieved_from_client_id,
          from: change.from,
          to: change.to
        }

      :delete ->
        %DeleteSchema{
          table: change.table,
          key: change.key,
          recieved_from_client_id: change.recieved_from_client_id,
          obj: change.obj
        }
    end
  end
end
