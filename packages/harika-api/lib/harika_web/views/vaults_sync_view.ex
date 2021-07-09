defmodule HarikaWeb.VaultsSyncView do
  use HarikaWeb, :view

  def render("push.json", %{push: push}) do
    render("pull.json", %{pull: push})
  end

  def render("pull.json", %{pull: pull}) do
    %{
      changes: %{
        vaults: %{
          created: render_many(pull.changes.vaults.created, __MODULE__, "vault.json", as: :vault),
          updated: render_many(pull.changes.vaults.updated, __MODULE__, "vault.json", as: :vault),
          deleted: pull.changes.vaults.deleted
        }
      },
      latestVersion: pull.latest_version
    }
  end

  def render("vault.json", %{vault: vault}) do
    %{
      id: vault.id,
      name: vault.name,
      created_at: vault.created_at |> DateTime.to_unix(:millisecond)
    }
  end
end
