defmodule HarikaWeb.DbChangesChannel do
  use Phoenix.Channel

  alias Harika.Sync

  def join("db_changes:" <> db_name, %{"client_id" => client_id}, socket) do
    socket =
      socket
      |> assign(:db_name, db_name)
      |> assign(:client_id, client_id)

    # TODO: auth db_name here

    {:ok, socket}
  end

  def handle_in(
        "get_changes",
        %{"from_revision" => from_revision, "include_self" => true},
        socket
      ) do
    %{db_name: db_name, client_id: client_id, user_id: user_id} = socket.assigns

    {:reply, {:ok, Sync.get_changes(user_id, db_name, client_id, from_revision)}, socket}
  end

  def handle_in(
        "apply_changes",
        %{"last_applied_remote_revision" => last_applied_remote_revision, "changes" => changes},
        socket
      ) do
    %{db_name: db_name, client_id: client_id, user_id: user_id} = socket.assigns

    if last_applied_remote_revision !== Sync.get_max_rev(user_id, db_name) do
      {:reply, {:ok, %{status: "stale_changes"}}}
    else
      newRev = Sync.apply_changes(changes, user_id, client_id, db_name)

      broadcast(socket, "revision_was_changed", %{newRev: newRev})

      {:reply, {:ok, %{status: "success", newRev: newRev}}, socket}
    end
  end
end
