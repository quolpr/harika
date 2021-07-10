defmodule Harika.Sync.Migrations do
  require Logger

  def get_migrations() do
    migration_modules = [
      {20210819_062207, Harika.Syncher.Migrations.CreateChangesTable}
    ]

    for {_version, module} <- migration_modules do
      if !migration?(module) do
        Logger.error(
          "#{inspect(module)} does not seem to be a migration module. Please make sure that your migration files are .ex and not .exs for runtime migrations."
        )
      end
    end

    migration_modules
  end

  defp migration?(mod) do
    function_exported?(mod, :__migration__, 0)
  end
end
