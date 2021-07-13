defmodule HarikaWeb.DbChangesChannel do
  use Phoenix.Channel

  alias Harika.Sync

  def join("db_changes:" <> db_name, %{"client_id" => client_id}, socket) do
    socket =
      socket
      |> assign(:db_name, db_name)
      |> assign(:client_id, client_id)

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

    res =
      Sync.apply_changes_with_lock(
        changes,
        last_applied_remote_revision,
        user_id,
        client_id,
        db_name
      )

    case res do
      {:ok, %{new_rev: new_rev}} ->
        broadcast(socket, "revision_was_changed", %{new_rev: new_rev})

      _ ->
        nil
    end

    {:reply, res, socket}
  end
end
