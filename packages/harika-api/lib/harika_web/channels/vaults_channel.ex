defmodule HarikaWeb.VaultsChannel do
  use Phoenix.Channel

  alias Harika.Vaults
  alias HarikaWeb.VaultsSyncView

  def join("user-vaults:" <> user_id, _params, socket) do
    if socket.assigns.user_id === user_id do
      socket =
        socket
        |> assign(:vaults_user_id, user_id)

      {:ok, socket}
    else
      {:error, "unauthed"}
    end
  end

  def handle_in("pull", %{"last_pulled_version" => last_pulled_version}, socket) do
    user_id = socket.assigns.vaults_user_id

    {:reply,
     {:ok,
      VaultsSyncView.render("pull.json", %{
        pull: Vaults.pull_vaults(user_id, last_pulled_version)
      })}, socket}
  end

  def handle_in(
        "push",
        %{"last_pulled_version" => last_pulled_version, "changes" => changes},
        socket
      ) do
    user_id = socket.assigns.vaults_user_id

    push = Vaults.push_vaults(user_id, changes, last_pulled_version)

    broadcast(socket, "vaults_updated", %{})

    {:reply, {:ok, VaultsSyncView.render("push.json", %{push: push})}, socket}
  end
end
