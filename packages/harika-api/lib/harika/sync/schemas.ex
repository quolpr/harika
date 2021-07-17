defmodule Harika.Sync.Schemas do
  defmodule CreateSchema do
    @derive Jason.Encoder
    @enforce_keys [:id, :table, :key, :recieved_from_client_id, :obj, :rev]
    defstruct [:id, :table, :key, :recieved_from_client_id, :obj, :rev, type: :create]
  end

  defmodule UpdateSchema do
    @derive Jason.Encoder
    @enforce_keys [:id, :table, :key, :recieved_from_client_id, :from, :to, :rev]
    defstruct [:id, :table, :key, :recieved_from_client_id, :from, :to, :rev, type: :update]
  end

  defmodule DeleteSchema do
    @derive Jason.Encoder
    @enforce_keys [:id, :table, :key, :recieved_from_client_id, :obj, :rev]
    defstruct [:id, :table, :key, :recieved_from_client_id, :obj, :rev, type: :delete]
  end
end
