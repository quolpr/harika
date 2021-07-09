defmodule Harika.Accounts do
  use Pow.Ecto.Context,
    repo: Harika.Repo,
    user: Harika.Accounts.User

  alias Harika.Accounts.User
  alias Harika.Repo

  import Ecto.Query, warn: false

  def authenticate(email, password) do
    pow_authenticate(%{"email" => email, "password" => password})
  end

  def create_user(params) do
    pow_create(params)
  end

  def get_user!(id) do
    Repo.get!(User, id)
  end
end
