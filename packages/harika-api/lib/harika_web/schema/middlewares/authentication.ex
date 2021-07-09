defmodule HarikaWeb.AuthenticationMiddleware do
  @behaviour Absinthe.Middleware

  alias Harika.Accounts.User

  def call(res, _config) do
    case res.context do
      %{current_user: %User{}} ->
        res

      _ ->
        Absinthe.Resolution.put_result(res, {:error, "unauthenticated"})
    end
  end
end
