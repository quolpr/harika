defmodule Harika.Sync.Schemas do
  @derive Jason.Encoder
  defmodule CreateSchema do
    @enforce_keys [:table, :key, :source, :obj]
    defstruct [:table, :key, :source, :obj]
  end

  @derive Jason.Encoder
  defmodule UpdateSchema do
    @enforce_keys [:table, :key, :source, :from, :to]
    defstruct [:table, :key, :source, :from, :to]
  end

  @derive Jason.Encoder
  defmodule DeleteSchema do
    @enforce_keys [:table, :key, :source, :obj]
    defstruct [:table, :key, :source, :obj]
  end
end
