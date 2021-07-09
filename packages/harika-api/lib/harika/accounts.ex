defmodule Harika.Accounts do
  use Pow.Ecto.Context,
    repo: Harika.Repo,
    user: Harika.Accounts.User

  alias Harika.Accounts.User
  alias Harika.Repo
  alias Harika.CouchDB

  import Ecto.Query, warn: false

  def authenticate(email, password) do
    pow_authenticate(%{"email" => email, "password" => password})
  end

  def create_user(params) do
    with {:ok, %User{db_id: db_id, db_pass: db_pass, email: email} = user} <- pow_create(params),
         db <- "harika_vaults_#{db_id}",
         :ok <- CouchDB.create_user(email, db_pass),
         :ok <- CouchDB.create_db(db),
         :ok <- CouchDB.put_db_member(db, email) do
      {:ok, user}
    else
      res -> res
    end
  end

  def create_user_vault_db(db_id, %User{email: email}) do
    blocks_db = "harika_vault_#{db_id}_noteblocks"
    notes_db = "harika_vault_#{db_id}_notes"

    with :ok <- CouchDB.create_db(blocks_db),
         :ok <- CouchDB.put_db_member(blocks_db, email),
         :ok <- CouchDB.create_db(notes_db),
         :ok <- CouchDB.put_db_member(notes_db, email) do
      :ok
    else
      _ -> :error
    end
  end

  def get_user!(id) do
    Repo.get!(User, id)
  end

  def get_couchdb_token(%User{email: email, db_pass: db_pass}) do
    CouchDB.get_auth_token(email, db_pass)
  end
end
