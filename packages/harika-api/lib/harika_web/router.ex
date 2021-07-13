defmodule HarikaWeb.Router do
  use HarikaWeb, :router
  use Pow.Phoenix.Router

  pipeline :api do
    plug :put_secure_browser_headers

    plug :accepts, ["json"]

    plug HarikaWeb.Schema.AuthContext
  end

  scope "/api" do
    pipe_through :api

    forward "/graphql", Absinthe.Plug,
      schema: HarikaWeb.Schema,
      json_codec: Jason,
      before_send: {__MODULE__, :absinthe_before_send}

    forward "/graphiql", Absinthe.Plug.GraphiQL,
      schema: HarikaWeb.Schema,
      interface: :playground,
      before_send: {__MODULE__, :absinthe_before_send}
  end

  def absinthe_before_send(conn, %Absinthe.Blueprint{} = blueprint) do
    if user_id = blueprint.execution.context[:set_current_user_id] do
      put_session(conn, :current_user_id, user_id)
    else
      conn
    end
  end

  def absinthe_before_send(conn, _) do
    conn
  end

  # Enables LiveDashboard only for development
  #
  # If you want to use the LiveDashboard in production, you should put
  # it behind authentication and allow only admins to access it.
  # If your application does not have an admins-only section yet,
  # you can use Plug.BasicAuth to set up some basic authentication
  # as long as you are also using SSL (which you should anyway).
  if Mix.env() in [:dev, :test] do
    import Phoenix.LiveDashboard.Router

    scope "/" do
      pipe_through [:fetch_session, :protect_from_forgery]
      live_dashboard "/dashboard", metrics: HarikaWeb.Telemetry
    end
  end
end
