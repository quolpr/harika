defmodule Harika.SyncTest do
  use Harika.DataCase, async: true

  @db_name "vault_123"

  alias Harika.Sync
  alias Harika.Sync.DbChange

  alias Harika.Accounts

  defp insert_user(_ctx) do
    {:ok, user} =
      Accounts.create_user(%{
        email: "test@test.com",
        password: "11111111",
        password_confirmation: "11111111"
      })

    {:ok, %{user: user, user_id: user.id}}
  end

  defp insert_change(%{user_id: user_id}, from_revision \\ 0) do
    Sync.apply_changes_with_lock(
      [
        %{
          "table" => "noteBlocks",
          "key" => "h6YjpmXhG2wbpvLcBuWX",
          "type" => "update",
          "from" => %{
            "content" => "fdsffwff",
            "linkedNoteIds" => [],
            "noteBlockIds" => []
          },
          "to" => %{
            "content" => "fdsffwfff",
            "linkedNoteIds" => [],
            "noteBlockIds" => []
          }
        }
      ],
      from_revision,
      user_id,
      "6404b319-405f-40b6-8bc1-4dc1fc028045",
      @db_name
    )
  end

  describe "apply_changes_with_lock" do
    setup [:insert_user]

    test "it works", %{user_id: user_id} do
      assert {:ok, %{new_rev: 1}} = insert_change(%{user_id: user_id})
    end
  end

  describe "apply_changes_with_lock with staled changes" do
    setup [:insert_user, :insert_change]

    test "it return error", %{user_id: user_id} do
      assert {:error, %{name: "stale_changes"}} = insert_change(%{user_id: user_id})
      assert {:error, %{name: "stale_changes"}} = insert_change(%{user_id: user_id}, nil)
    end
  end

  describe "get_max_rev - when changes inserted" do
    setup [:insert_user, :insert_change]

    test "it returns number", %{user_id: user_id} do
      assert 1 === Sync.get_max_rev(user_id, @db_name)
    end
  end

  describe "get_max_rev - when changes not inserted" do
    setup [:insert_user]

    test "it returns nil", %{user_id: user_id} do
      assert nil === Sync.get_max_rev(user_id, @db_name)
    end
  end

  describe "get_changes" do
    setup [:insert_user, :insert_change]

    test "it returns changes", %{user_id: user_id} do
      assert %{changes: [%DbChange{}], max_rev: 1} =
               Sync.get_changes(user_id, @db_name, Ecto.UUID.generate(), 0)
    end
  end
end
