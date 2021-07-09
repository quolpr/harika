defmodule Harika.NotesVaultsTest do
  use Harika.DataCase

  alias Harika.NotesVaults

  describe "notes_vaults" do
    alias Harika.NotesVaults.NotesVault

    @valid_attrs %{created_at: "2010-04-17T14:00:00.000000Z", created_at_server: "2010-04-17T14:00:00.000000Z", deleted_at_server: "2010-04-17T14:00:00.000000Z", push_id: 42, title: "some title", updated_at: "2010-04-17T14:00:00.000000Z", updated_at_server: "2010-04-17T14:00:00.000000Z", version: 42, version_created: 42}
    @update_attrs %{created_at: "2011-05-18T15:01:01.000000Z", created_at_server: "2011-05-18T15:01:01.000000Z", deleted_at_server: "2011-05-18T15:01:01.000000Z", push_id: 43, title: "some updated title", updated_at: "2011-05-18T15:01:01.000000Z", updated_at_server: "2011-05-18T15:01:01.000000Z", version: 43, version_created: 43}
    @invalid_attrs %{created_at: nil, created_at_server: nil, deleted_at_server: nil, push_id: nil, title: nil, updated_at: nil, updated_at_server: nil, version: nil, version_created: nil}

    def notes_vault_fixture(attrs \\ %{}) do
      {:ok, notes_vault} =
        attrs
        |> Enum.into(@valid_attrs)
        |> NotesVaults.create_notes_vault()

      notes_vault
    end

    test "list_notes_vaults/0 returns all notes_vaults" do
      notes_vault = notes_vault_fixture()
      assert NotesVaults.list_notes_vaults() == [notes_vault]
    end

    test "get_notes_vault!/1 returns the notes_vault with given id" do
      notes_vault = notes_vault_fixture()
      assert NotesVaults.get_notes_vault!(notes_vault.id) == notes_vault
    end

    test "create_notes_vault/1 with valid data creates a notes_vault" do
      assert {:ok, %NotesVault{} = notes_vault} = NotesVaults.create_notes_vault(@valid_attrs)
      assert notes_vault.created_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_vault.created_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_vault.deleted_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_vault.push_id == 42
      assert notes_vault.title == "some title"
      assert notes_vault.updated_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_vault.updated_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_vault.version == 42
      assert notes_vault.version_created == 42
    end

    test "create_notes_vault/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = NotesVaults.create_notes_vault(@invalid_attrs)
    end

    test "update_notes_vault/2 with valid data updates the notes_vault" do
      notes_vault = notes_vault_fixture()
      assert {:ok, %NotesVault{} = notes_vault} = NotesVaults.update_notes_vault(notes_vault, @update_attrs)
      assert notes_vault.created_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_vault.created_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_vault.deleted_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_vault.push_id == 43
      assert notes_vault.title == "some updated title"
      assert notes_vault.updated_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_vault.updated_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_vault.version == 43
      assert notes_vault.version_created == 43
    end

    test "update_notes_vault/2 with invalid data returns error changeset" do
      notes_vault = notes_vault_fixture()
      assert {:error, %Ecto.Changeset{}} = NotesVaults.update_notes_vault(notes_vault, @invalid_attrs)
      assert notes_vault == NotesVaults.get_notes_vault!(notes_vault.id)
    end

    test "delete_notes_vault/1 deletes the notes_vault" do
      notes_vault = notes_vault_fixture()
      assert {:ok, %NotesVault{}} = NotesVaults.delete_notes_vault(notes_vault)
      assert_raise Ecto.NoResultsError, fn -> NotesVaults.get_notes_vault!(notes_vault.id) end
    end

    test "change_notes_vault/1 returns a notes_vault changeset" do
      notes_vault = notes_vault_fixture()
      assert %Ecto.Changeset{} = NotesVaults.change_notes_vault(notes_vault)
    end
  end

  describe "notes_links" do
    alias Harika.NotesVaults.NotesLink

    @valid_attrs %{created_at: "2010-04-17T14:00:00.000000Z", created_at_server: "2010-04-17T14:00:00.000000Z", deleted_at_server: "2010-04-17T14:00:00.000000Z", push_id: 42, updated_at: "2010-04-17T14:00:00.000000Z", updated_at_server: "2010-04-17T14:00:00.000000Z", version: 42, version_created: 42}
    @update_attrs %{created_at: "2011-05-18T15:01:01.000000Z", created_at_server: "2011-05-18T15:01:01.000000Z", deleted_at_server: "2011-05-18T15:01:01.000000Z", push_id: 43, updated_at: "2011-05-18T15:01:01.000000Z", updated_at_server: "2011-05-18T15:01:01.000000Z", version: 43, version_created: 43}
    @invalid_attrs %{created_at: nil, created_at_server: nil, deleted_at_server: nil, push_id: nil, updated_at: nil, updated_at_server: nil, version: nil, version_created: nil}

    def notes_link_fixture(attrs \\ %{}) do
      {:ok, notes_link} =
        attrs
        |> Enum.into(@valid_attrs)
        |> NotesVaults.create_notes_link()

      notes_link
    end

    test "list_notes_links/0 returns all notes_links" do
      notes_link = notes_link_fixture()
      assert NotesVaults.list_notes_links() == [notes_link]
    end

    test "get_notes_link!/1 returns the notes_link with given id" do
      notes_link = notes_link_fixture()
      assert NotesVaults.get_notes_link!(notes_link.id) == notes_link
    end

    test "create_notes_link/1 with valid data creates a notes_link" do
      assert {:ok, %NotesLink{} = notes_link} = NotesVaults.create_notes_link(@valid_attrs)
      assert notes_link.created_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_link.created_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_link.deleted_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_link.push_id == 42
      assert notes_link.updated_at == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_link.updated_at_server == DateTime.from_naive!(~N[2010-04-17T14:00:00.000000Z], "Etc/UTC")
      assert notes_link.version == 42
      assert notes_link.version_created == 42
    end

    test "create_notes_link/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = NotesVaults.create_notes_link(@invalid_attrs)
    end

    test "update_notes_link/2 with valid data updates the notes_link" do
      notes_link = notes_link_fixture()
      assert {:ok, %NotesLink{} = notes_link} = NotesVaults.update_notes_link(notes_link, @update_attrs)
      assert notes_link.created_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_link.created_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_link.deleted_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_link.push_id == 43
      assert notes_link.updated_at == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_link.updated_at_server == DateTime.from_naive!(~N[2011-05-18T15:01:01.000000Z], "Etc/UTC")
      assert notes_link.version == 43
      assert notes_link.version_created == 43
    end

    test "update_notes_link/2 with invalid data returns error changeset" do
      notes_link = notes_link_fixture()
      assert {:error, %Ecto.Changeset{}} = NotesVaults.update_notes_link(notes_link, @invalid_attrs)
      assert notes_link == NotesVaults.get_notes_link!(notes_link.id)
    end

    test "delete_notes_link/1 deletes the notes_link" do
      notes_link = notes_link_fixture()
      assert {:ok, %NotesLink{}} = NotesVaults.delete_notes_link(notes_link)
      assert_raise Ecto.NoResultsError, fn -> NotesVaults.get_notes_link!(notes_link.id) end
    end

    test "change_notes_link/1 returns a notes_link changeset" do
      notes_link = notes_link_fixture()
      assert %Ecto.Changeset{} = NotesVaults.change_notes_link(notes_link)
    end
  end
end
