defmodule Harika.HarikaNotesTest do
  use Harika.DataCase

  alias Harika.HarikaNotes

  describe "notes" do
    alias Harika.HarikaNotes.Note

    @valid_attrs %{child_block_ids: [], created_at: "2010-04-17T14:00:00.000000Z", created_at_server: "2010-04-17T14:00:00.000000Z", daily_note_date: "2010-04-17T14:00:00.000000Z", deleted_at_server: "2010-04-17T14:00:00.000000Z", push_id: 42, title: "some title", updated_at: "2010-04-17T14:00:00.000000Z", updated_at_server: "2010-04-17T14:00:00.000000Z", version: 42, version_created: 42}
    @update_attrs %{child_block_ids: [], created_at: "2011-05-18T15:01:01.000000Z", created_at_server: "2011-05-18T15:01:01.000000Z", daily_note_date: "2011-05-18T15:01:01.000000Z", deleted_at_server: "2011-05-18T15:01:01.000000Z", push_id: 43, title: "some updated title", updated_at: "2011-05-18T15:01:01.000000Z", updated_at_server: "2011-05-18T15:01:01.000000Z", version: 43, version_created: 43}
    @invalid_attrs %{child_block_ids: nil, created_at: nil, created_at_server: nil, daily_note_date: nil, deleted_at_server: nil, push_id: nil, title: nil, updated_at: nil, updated_at_server: nil, version: nil, version_created: nil}

    def note_fixture(attrs \\ %{}) do
      {:ok, note} =
        attrs
        |> Enum.into(@valid_attrs)
        |> HarikaNotes.create_note()

      note
    end

    test "list_notes/0 returns all notes" do
      note = note_fixture()
      assert HarikaNotes.list_notes() == [note]
    end

    test "get_note!/1 returns the note with given id" do
      note = note_fixture()
      assert HarikaNotes.get_note!(note.id) == note
    end

    test "create_note/1 with valid data creates a note" do
      assert {:ok, %Note{} = note} = HarikaNotes.create_note(@valid_attrs)
      assert note.child_block_ids == []
      assert note.created_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.created_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.daily_note_date == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.deleted_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.push_id == 42
      assert note.title == "some title"
      assert note.updated_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.updated_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.version == 42
      assert note.version_created == 42
    end

    test "create_note/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = HarikaNotes.create_note(@invalid_attrs)
    end

    test "update_note/2 with valid data updates the note" do
      note = note_fixture()
      assert {:ok, %Note{} = note} = HarikaNotes.update_note(note, @update_attrs)
      assert note.child_block_ids == []
      assert note.created_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.created_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.daily_note_date == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.deleted_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.push_id == 43
      assert note.title == "some updated title"
      assert note.updated_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.updated_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.version == 43
      assert note.version_created == 43
    end

    test "update_note/2 with invalid data returns error changeset" do
      note = note_fixture()
      assert {:error, %Ecto.Changeset{}} = HarikaNotes.update_note(note, @invalid_attrs)
      assert note == HarikaNotes.get_note!(note.id)
    end

    test "delete_note/1 deletes the note" do
      note = note_fixture()
      assert {:ok, %Note{}} = HarikaNotes.delete_note(note)
      assert_raise Ecto.NoResultsError, fn -> HarikaNotes.get_note!(note.id) end
    end

    test "change_note/1 returns a note changeset" do
      note = note_fixture()
      assert %Ecto.Changeset{} = HarikaNotes.change_note(note)
    end
  end
end
