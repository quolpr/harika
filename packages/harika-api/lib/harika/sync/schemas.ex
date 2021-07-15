defmodule Harika.Sync.Schemas do
  defmodule CreateSchema do
    @derive Jason.Encoder
    @enforce_keys [:id, :table, :key, :recieved_from_client_id, :obj]
    defstruct [:id, :table, :key, :recieved_from_client_id, :obj, type: :create]
  end

  defmodule UpdateSchema do
    @derive Jason.Encoder
    @enforce_keys [:id, :table, :key, :recieved_from_client_id, :from, :to]
    defstruct [:id, :table, :key, :recieved_from_client_id, :from, :to, type: :update]
  end

  defmodule DeleteSchema do
    @derive Jason.Encoder
    @enforce_keys [:id, :table, :key, :recieved_from_client_id, :obj]
    defstruct [:id, :table, :key, :recieved_from_client_id, :obj, type: :delete]
  end
end
