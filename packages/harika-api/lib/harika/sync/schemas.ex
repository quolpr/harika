defmodule Harika.Sync.Schemas do
  @derive Jason.Encoder
  defmodule CreateSchema do
    @enforce_keys [:table, :key, :recieved_from_client_id, :obj]
    defstruct [:table, :key, :recieved_from_client_id, :obj]
  end

  @derive Jason.Encoder
  defmodule UpdateSchema do
    @enforce_keys [:table, :key, :recieved_from_client_id, :from, :to]
    defstruct [:table, :key, :recieved_from_client_id, :from, :to]
  end

  @derive Jason.Encoder
  defmodule DeleteSchema do
    @enforce_keys [:table, :key, :recieved_from_client_id, :obj]
    defstruct [:table, :key, :recieved_from_client_id, :obj]
  end
end
