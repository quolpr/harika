defmodule Harika.NotesTest do
  use Harika.DataCase

  alias Harika.Notes

  describe "notes" do
    alias Harika.Notes.Note

    @valid_attrs %{child_block_ids: [], created_at: "2010-04-17T14:00:00.000000Z", created_at_server: "2010-04-17T14:00:00.000000Z", daily_note_date: "2010-04-17T14:00:00.000000Z", deleted_at_server: "2010-04-17T14:00:00.000000Z", push_id: 42, title: "some title", updated_at: "2010-04-17T14:00:00.000000Z", updated_at_server: "2010-04-17T14:00:00.000000Z", version: 42, version_created: 42}
    @update_attrs %{child_block_ids: [], created_at: "2011-05-18T15:01:01.000000Z", created_at_server: "2011-05-18T15:01:01.000000Z", daily_note_date: "2011-05-18T15:01:01.000000Z", deleted_at_server: "2011-05-18T15:01:01.000000Z", push_id: 43, title: "some updated title", updated_at: "2011-05-18T15:01:01.000000Z", updated_at_server: "2011-05-18T15:01:01.000000Z", version: 43, version_created: 43}
    @invalid_attrs %{child_block_ids: nil, created_at: nil, created_at_server: nil, daily_note_date: nil, deleted_at_server: nil, push_id: nil, title: nil, updated_at: nil, updated_at_server: nil, version: nil, version_created: nil}

    def note_fixture(attrs \\ %{}) do
      {:ok, note} =
        attrs
        |> Enum.into(@valid_attrs)
        |> Notes.create_note()

      note
    end

    test "list_notes/0 returns all notes" do
      note = note_fixture()
      assert Notes.list_notes() == [note]
    end

    test "get_note!/1 returns the note with given id" do
      note = note_fixture()
      assert Notes.get_note!(note.id) == note
    end

    test "create_note/1 with valid data creates a note" do
      assert {:ok, %Note{} = note} = Notes.create_note(@valid_attrs)
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
      assert {:error, %Ecto.Changeset{}} = Notes.create_note(@invalid_attrs)
    end

    test "update_note/2 with valid data updates the note" do
      note = note_fixture()
      assert {:ok, %Note{} = note} = Notes.update_note(note, @update_attrs)
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
      assert {:error, %Ecto.Changeset{}} = Notes.update_note(note, @invalid_attrs)
      assert note == Notes.get_note!(note.id)
    end

    test "delete_note/1 deletes the note" do
      note = note_fixture()
      assert {:ok, %Note{}} = Notes.delete_note(note)
      assert_raise Ecto.NoResultsError, fn -> Notes.get_note!(note.id) end
    end

    test "change_note/1 returns a note changeset" do
      note = note_fixture()
      assert %Ecto.Changeset{} = Notes.change_note(note)
    end
  end

  describe "note_blocks" do
    alias Harika.Notes.Note

    @valid_attrs %{child_block_ids: [], content: "some content", created_at: "2010-04-17T14:00:00.000000Z", created_at_server: "2010-04-17T14:00:00.000000Z", deleted_at_server: "2010-04-17T14:00:00.000000Z", linked_note_ids: [], note_id: "some note_id", parent_block_id: "some parent_block_id", push_id: 42, updated_at: "2010-04-17T14:00:00.000000Z", updated_at_server: "2010-04-17T14:00:00.000000Z", version: 42, version_created: 42}
    @update_attrs %{child_block_ids: [], content: "some updated content", created_at: "2011-05-18T15:01:01.000000Z", created_at_server: "2011-05-18T15:01:01.000000Z", deleted_at_server: "2011-05-18T15:01:01.000000Z", linked_note_ids: [], note_id: "some updated note_id", parent_block_id: "some updated parent_block_id", push_id: 43, updated_at: "2011-05-18T15:01:01.000000Z", updated_at_server: "2011-05-18T15:01:01.000000Z", version: 43, version_created: 43}
    @invalid_attrs %{child_block_ids: nil, content: nil, created_at: nil, created_at_server: nil, deleted_at_server: nil, linked_note_ids: nil, note_id: nil, parent_block_id: nil, push_id: nil, updated_at: nil, updated_at_server: nil, version: nil, version_created: nil}

    def note_fixture(attrs \\ %{}) do
      {:ok, note} =
        attrs
        |> Enum.into(@valid_attrs)
        |> Notes.create_note()

      note
    end

    test "list_note_blocks/0 returns all note_blocks" do
      note = note_fixture()
      assert Notes.list_note_blocks() == [note]
    end

    test "get_note!/1 returns the note with given id" do
      note = note_fixture()
      assert Notes.get_note!(note.id) == note
    end

    test "create_note/1 with valid data creates a note" do
      assert {:ok, %Note{} = note} = Notes.create_note(@valid_attrs)
      assert note.child_block_ids == []
      assert note.content == "some content"
      assert note.created_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.created_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.deleted_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.linked_note_ids == []
      assert note.note_id == "some note_id"
      assert note.parent_block_id == "some parent_block_id"
      assert note.push_id == 42
      assert note.updated_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.updated_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note.version == 42
      assert note.version_created == 42
    end

    test "create_note/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Notes.create_note(@invalid_attrs)
    end

    test "update_note/2 with valid data updates the note" do
      note = note_fixture()
      assert {:ok, %Note{} = note} = Notes.update_note(note, @update_attrs)
      assert note.child_block_ids == []
      assert note.content == "some updated content"
      assert note.created_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.created_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.deleted_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.linked_note_ids == []
      assert note.note_id == "some updated note_id"
      assert note.parent_block_id == "some updated parent_block_id"
      assert note.push_id == 43
      assert note.updated_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.updated_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note.version == 43
      assert note.version_created == 43
    end

    test "update_note/2 with invalid data returns error changeset" do
      note = note_fixture()
      assert {:error, %Ecto.Changeset{}} = Notes.update_note(note, @invalid_attrs)
      assert note == Notes.get_note!(note.id)
    end

    test "delete_note/1 deletes the note" do
      note = note_fixture()
      assert {:ok, %Note{}} = Notes.delete_note(note)
      assert_raise Ecto.NoResultsError, fn -> Notes.get_note!(note.id) end
    end

    test "change_note/1 returns a note changeset" do
      note = note_fixture()
      assert %Ecto.Changeset{} = Notes.change_note(note)
    end
  end

  describe "note_blocks" do
    alias Harika.Notes.NoteBlock

    @valid_attrs %{child_block_ids: [], content: "some content", created_at: "2010-04-17T14:00:00.000000Z", created_at_server: "2010-04-17T14:00:00.000000Z", deleted_at_server: "2010-04-17T14:00:00.000000Z", linked_note_ids: [], note_id: "some note_id", parent_block_id: "some parent_block_id", push_id: 42, updated_at: "2010-04-17T14:00:00.000000Z", updated_at_server: "2010-04-17T14:00:00.000000Z", version: 42, version_created: 42}
    @update_attrs %{child_block_ids: [], content: "some updated content", created_at: "2011-05-18T15:01:01.000000Z", created_at_server: "2011-05-18T15:01:01.000000Z", deleted_at_server: "2011-05-18T15:01:01.000000Z", linked_note_ids: [], note_id: "some updated note_id", parent_block_id: "some updated parent_block_id", push_id: 43, updated_at: "2011-05-18T15:01:01.000000Z", updated_at_server: "2011-05-18T15:01:01.000000Z", version: 43, version_created: 43}
    @invalid_attrs %{child_block_ids: nil, content: nil, created_at: nil, created_at_server: nil, deleted_at_server: nil, linked_note_ids: nil, note_id: nil, parent_block_id: nil, push_id: nil, updated_at: nil, updated_at_server: nil, version: nil, version_created: nil}

    def note_block_fixture(attrs \\ %{}) do
      {:ok, note_block} =
        attrs
        |> Enum.into(@valid_attrs)
        |> Notes.create_note_block()

      note_block
    end

    test "list_note_blocks/0 returns all note_blocks" do
      note_block = note_block_fixture()
      assert Notes.list_note_blocks() == [note_block]
    end

    test "get_note_block!/1 returns the note_block with given id" do
      note_block = note_block_fixture()
      assert Notes.get_note_block!(note_block.id) == note_block
    end

    test "create_note_block/1 with valid data creates a note_block" do
      assert {:ok, %NoteBlock{} = note_block} = Notes.create_note_block(@valid_attrs)
      assert note_block.child_block_ids == []
      assert note_block.content == "some content"
      assert note_block.created_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note_block.created_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note_block.deleted_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note_block.linked_note_ids == []
      assert note_block.note_id == "some note_id"
      assert note_block.parent_block_id == "some parent_block_id"
      assert note_block.push_id == 42
      assert note_block.updated_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note_block.updated_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert note_block.version == 42
      assert note_block.version_created == 42
    end

    test "create_note_block/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Notes.create_note_block(@invalid_attrs)
    end

    test "update_note_block/2 with valid data updates the note_block" do
      note_block = note_block_fixture()
      assert {:ok, %NoteBlock{} = note_block} = Notes.update_note_block(note_block, @update_attrs)
      assert note_block.child_block_ids == []
      assert note_block.content == "some updated content"
      assert note_block.created_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note_block.created_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note_block.deleted_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note_block.linked_note_ids == []
      assert note_block.note_id == "some updated note_id"
      assert note_block.parent_block_id == "some updated parent_block_id"
      assert note_block.push_id == 43
      assert note_block.updated_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note_block.updated_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert note_block.version == 43
      assert note_block.version_created == 43
    end

    test "update_note_block/2 with invalid data returns error changeset" do
      note_block = note_block_fixture()
      assert {:error, %Ecto.Changeset{}} = Notes.update_note_block(note_block, @invalid_attrs)
      assert note_block == Notes.get_note_block!(note_block.id)
    end

    test "delete_note_block/1 deletes the note_block" do
      note_block = note_block_fixture()
      assert {:ok, %NoteBlock{}} = Notes.delete_note_block(note_block)
      assert_raise Ecto.NoResultsError, fn -> Notes.get_note_block!(note_block.id) end
    end

    test "change_note_block/1 returns a note_block changeset" do
      note_block = note_block_fixture()
      assert %Ecto.Changeset{} = Notes.change_note_block(note_block)
    end
  end
end
