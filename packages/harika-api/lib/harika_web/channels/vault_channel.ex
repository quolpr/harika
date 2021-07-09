defmodule HarikaWeb.VaultChannel do
  use Phoenix.Channel

  alias Harika.Vaults
  alias HarikaWeb.VaultSyncView

  def join("vaults:" <> vault_id, _params, socket) do
    socket =
      socket
      |> assign(:vault_id, vault_id)

    {:ok, socket}
  end

  def handle_in("pull", %{"last_pulled_version" => last_pulled_version}, socket) do
    vault_id = socket.assigns.vault_id

    {:reply,
     {:ok,
      VaultSyncView.render("pull.json", %{
        pull: Vaults.pull_vault_entities(vault_id, last_pulled_version)
      })}, socket}
  end

  def handle_in(
        "push",
        %{"last_pulled_version" => last_pulled_version, "changes" => changes},
        socket
      ) do
    vault_id = socket.assigns.vault_id

    push = Vaults.push_vault_entities(vault_id, changes, last_pulled_version)

    broadcast(socket, "vault_updated", %{})

    {:reply, {:ok, VaultSyncView.render("push.json", %{push: push})}, socket}
  end
end
