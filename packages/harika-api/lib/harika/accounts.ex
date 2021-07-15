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
    Repo.transaction(fn ->
      with {:ok, %User{id: id}} = result <- pow_create(params) do
        Harika.Sync.create_db_for_user_id(id)

        result
      else
        {:error, res} ->
          Repo.rollback(res)
      end
    end)
    |> case do
      {:ok, res} -> res
      res -> res
    end
  end

  def get_user!(id) do
    Repo.get!(User, id)
  end
end
