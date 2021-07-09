defmodule HarikaWeb.Authentication do
  @key "user"

  defmodule AuthInfo do
    defstruct [:user_id]
  end

  def encode_token(params = %AuthInfo{}) do
    Phoenix.Token.sign(HarikaWeb.Endpoint, @key, params)
  end

  @spec decode_token(String.t()) :: {:ok, AuthInfo.t()} | {:error, any()}
  def decode_token(token) do
    Phoenix.Token.verify(HarikaWeb.Endpoint, @key, token, max_age: 365 * 24 * 3600)
  end
end
