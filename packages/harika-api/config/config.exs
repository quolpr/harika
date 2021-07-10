# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
use Mix.Config

config :harika,
  ecto_repos: [Harika.Repo],
  generators: [binary_id: true]

config :ex_lock,
  repo: Harika.Repo

# Configures the endpoint
config :harika, HarikaWeb.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "HX+YWCVeXBZ1VhFGyDnRQW6pEhpsPD8D3+NqMet0HGpCBHIB+Mg29kliwZouCiIL",
  render_errors: [view: HarikaWeb.ErrorView, accepts: ~w(json), layout: false],
  pubsub_server: Harika.PubSub,
  live_view: [signing_salt: "Ydycsq3j"]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

config :harika, :pow,
  user: Harika.Accounts.User,
  repo: Harika.Repo,
  users_context: Harika.Accounts

config :nanoid,
  size: 18,
  alphabet: "0123456789abcdefghijklmnopqrstuvwxyz"

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env()}.exs"
