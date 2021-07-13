defmodule Harika.HarikaNotesTest do
  use Harika.DataCase, async: true

  alias Harika.Accounts
  alias Harika.Accounts.User

  describe "create_user" do
    test "it works" do
      assert {:ok, %User{}} =
               Accounts.create_user(%{
                 email: "test@test.com",
                 password: "11111111",
                 password_confirmation: "11111111"
               })
    end
  end
end
