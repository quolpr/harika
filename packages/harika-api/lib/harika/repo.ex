defmodule Harika.Repo do
  use Ecto.Repo,
    otp_app: :harika,
    adapter: Ecto.Adapters.Postgres
end
