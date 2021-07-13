defmodule HarikaWeb.Schema.AccountsResolver do
  alias Harika.Accounts

  alias Harika.Accounts.User

  def login(_, %{email: email, password: password}, _) do
    case Accounts.authenticate(email, password) do
      %User{} = user ->
        {:ok, %{user: user}}

      _ ->
        {:error, "Incorrect email or password"}
    end
  end

  def create_user(_parent, %{params: params}, _resolution) do
    password = Map.get(params, :password)
    params = Map.put(params, :confirm_password, password)

    with {:ok, user} <- Accounts.create_user(params) do
      {:ok, %{user: user}}
    else
      err -> err
    end
  end
end
