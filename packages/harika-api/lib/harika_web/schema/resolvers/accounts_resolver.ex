defmodule HarikaWeb.Schema.AccountsResolver do
  alias Harika.Accounts

  alias Harika.Accounts.User

  def login(_, %{email: email, password: password}, _) do
    case Accounts.authenticate(email, password) do
      %User{} = user ->
        {:ok, %{user: user, db_auth_token: Accounts.get_couchdb_token(user)}}

      _ ->
        {:error, "Incorrect email or password"}
    end
  end

  def create_user(_parent, %{params: params}, _resolution) do
    password = Map.get(params, :password)
    params = Map.put(params, :confirm_password, password)

    with {:ok, user} <- Accounts.create_user(params) do
      {:ok, %{user: user, db_auth_token: Accounts.get_couchdb_token(user)}}
    else
      err -> err
    end
  end

  def create_vault_db(
        _parent,
        %{db_id: db_id},
        %{context: %{current_user: current_user}}
      ) do
    {:ok, Accounts.create_user_vault_db(db_id, current_user) === :ok}
  end
end
