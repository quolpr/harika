defmodule Harika.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  def start(_type, _args) do
    children = [
      {Redlock,
       [
         pool_size: 2,
         servers: [
           [host: "localhost", port: 6379]
         ]
       ]},
      # Start the Ecto repository
      Harika.Repo,
      # Start the Telemetry supervisor
      HarikaWeb.Telemetry,
      # Start the PubSub system
      {Phoenix.PubSub, name: Harika.PubSub},
      # Start the Endpoint (http/https)
      HarikaWeb.Endpoint
      # Start a worker by calling: Harika.Worker.start_link(arg)
      # {Harika.Worker, arg}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Harika.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  def config_change(changed, _new, removed) do
    HarikaWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
