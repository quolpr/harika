defmodule HarikaWeb.AuthContext do
  @behaviour Plug

  alias Harika.Accounts

  def init(opts), do: opts

  def call(conn, _) do
    context = build_context(conn)
    Absinthe.Plug.put_options(conn, context: context)
  end

  @doc """
  Return the current user context based on the authorization header
  """
  def build_context(conn) do
    with user_id when not is_nil(user_id) <- Plug.Conn.get_session(conn, :current_user_id),
         current_user <- Accounts.get_user!(user_id) do
      %{current_user: current_user}
    else
      _ -> %{}
    end
  end
end
