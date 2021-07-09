defmodule Harika.Sync.DbChange do
  defmacro change_fields() do
    quote do
      alias Harika.Accounts.User

      belongs_to :owner, User

      field :rev, :integer

      field :from, :map
      field :to, :map

      field :scope_id, :binary_id
      field :source, :string
      field :type, Ecto.Enum, values: [:create, :update, :delete]
      field :table, :string
      field :key, :binary_id
      field :obj, :map

      field :created_at, :utc_datetime_usec
      field :updated_at, :utc_datetime_usec
    end
  end

  defmacro __using__(_opts) do
    quote do
      import Harika.Sync.DbChange, only: [change_fields: 0, change_methods: 0]
    end
  end

  defmacro change_methods do
    quote do
      def to_schema(%__MODULE__{} = change) do
        alias Harika.Sync.Schemas.CreateSchema
        alias Harika.Sync.Schemas.UpdateSchema
        alias Harika.Sync.Schemas.DeleteSchema

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
  end
end
