defmodule Harika.Sync.DbChangeTest do
  use ExUnit.Case, async: true

  alias Harika.Sync.DbChange

  describe "to_model!" do
    test "works" do
      assert %DbChange{} =
               DbChange.to_model!(%{
                 "db_name" => "test",
                 "recieved_from_client_id" => Ecto.UUID.generate(),
                 "table" => "noteBlocks",
                 "key" => "h6YjpmXhG2wbpvLcBuWX",
                 "type" => "update",
                 "rev" => 4063,
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
               })
    end
  end
end
