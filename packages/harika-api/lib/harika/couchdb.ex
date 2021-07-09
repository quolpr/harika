# TODO: proxy auth
defmodule Harika.CouchDB do
  use Tesla

  require Logger

  plug Tesla.Middleware.BaseUrl, "http://localhost:5984/"

  plug Tesla.Middleware.Headers, [
    {"Authorization", "Basic #{Base.url_encode64("admin:admin")}"},
    {"Accept", "application/json"}
  ]

  plug Tesla.Middleware.JSON

  def create_user(user, pass) do
    case put("_users/org.couchdb.user:#{user}", %{
           name: user,
           password: pass,
           roles: [],
           type: "user"
         }) do
      {:ok, %Tesla.Env{body: %{"ok" => true}}} ->
        Logger.info("CouchDB: user #{user} is created")

        :ok

      val ->
        Logger.error(inspect({"Failed to create user", val}))

        :error
    end
  end

  def create_db(db) do
    case put(db, %{}) do
      {:ok, %Tesla.Env{body: %{"ok" => true}}} ->
        Logger.info("CouchDB: db #{db} is created")
        :ok

      val ->
        Logger.error(inspect({"Failed to create db", val}))

        :error
    end
  end

  def put_db_member(db, name) do
    case put("#{db}/_security", %{
           "members" => %{
             "names" => [
               name
             ]
           }
         }) do
      {:ok, %Tesla.Env{body: %{"ok" => true}}} ->
        Logger.info("CouchDB: member #{name} is added to #{db}")

        :ok

      val ->
        Logger.error(inspect({"Failed to create db", val}))

        :error
    end
  end

  # TODO: cookie way in future
  def get_auth_token(name, pass) do
    # case post("/_session", %{
    #        name: name,
    #        password: pass
    #      }) do
    #   {:ok, %Tesla.Env{body: %{"ok" => true}}} = val ->
    #     IO.inspect(val)

    #     :ok

    #   val ->
    #     Logger.error(inspect({"Failed to create user", val}))

    #     :error
    # end

    Base.url_encode64("#{name}:#{pass}")
  end
end
