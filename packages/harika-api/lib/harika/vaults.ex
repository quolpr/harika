defmodule Harika.Vaults do
  alias Harika.Syncher
  alias Harika.Repo
  alias Harika.Vaults.Vault
  alias Harika.Vaults.Note
  alias Harika.Vaults.NoteBlock
  alias Harika.Vaults.NoteLink

  import Ecto.Query, warn: false

  @fields_to_take [
    "id",
    "created_at",
    "updated_at",
    "created_at_server",
    "updated_at_server",
    "push_id"
  ]

  def push_vaults(user_id, changes, last_pulled_version) do
    push_id = Enum.random(1..1_000_000_000)

    Ecto.Multi.new()
    |> Syncher.record_entities(
      changes["vaults"],
      last_pulled_version,
      push_id,
      Vault,
      fn row ->
        row
        |> Map.take(
          [
            "name"
          ] ++ @fields_to_take
        )
        |> Map.put("user_id", user_id)
      end,
      vaults_query(user_id)
    )
    |> Repo.transaction()

    pull_vaults(user_id, last_pulled_version, push_id)
  end

  def pull_vaults(user_id, last_pulled_version, push_id \\ nil) do
    %{latest_version: latest_version_vaults, changes: vaults_changes} =
      Syncher.list_entities_changes(
        last_pulled_version,
        push_id,
        Vault,
        vaults_query(user_id)
      )

    %{
      latest_version: Enum.max([latest_version_vaults, last_pulled_version]),
      changes: %{
        vaults: vaults_changes
      }
    }
  end

  def push_vault_entities(vault_id, changes, last_pulled_version) do
    push_id = Enum.random(1..1_000_000_000)

    Ecto.Multi.new()
    |> Syncher.record_entities(
      changes["notes"],
      last_pulled_version,
      push_id,
      Note,
      # TODO add check that note belongs to user
      fn row ->
        row
        |> Map.put(
          "daily_note_date",
          if(row["daily_note_date"],
            do: (row["daily_note_date"] * 1000) |> DateTime.from_unix!(:microsecond),
            else: row["daily_note_date"]
          )
        )
        |> Map.take(
          [
            "daily_note_date",
            "title"
          ] ++ @fields_to_take
        )
        |> Map.put("vault_id", vault_id)
      end,
      vault_notes_query(vault_id)
    )
    |> Syncher.record_entities(
      changes["note_blocks"],
      last_pulled_version,
      push_id,
      NoteBlock,
      # TODO add check that note block belongs to user
      fn row ->
        row
        |> Map.take(
          [
            "order_position",
            "content",
            "note_id",
            "parent_block_id"
          ] ++ @fields_to_take
        )
      end,
      vault_note_blocks_query(vault_id)
    )
    |> Syncher.record_entities(
      changes["note_links"],
      last_pulled_version,
      push_id,
      NoteLink,
      # TODO add check that note block belongs to user
      fn row ->
        row
        |> Map.take(
          [
            "note_id",
            "note_block_id"
          ] ++ @fields_to_take
        )
      end,
      vault_note_links_query(vault_id)
    )
    |> Repo.transaction()

    pull_vault_entities(vault_id, last_pulled_version, push_id)
  end

  def pull_vault_entities(vault_id, last_pulled_version, push_id \\ nil) do
    %{latest_version: latest_version_notes, changes: notes_changes} =
      Syncher.list_entities_changes(
        last_pulled_version,
        push_id,
        Note,
        vault_notes_query(vault_id)
      )

    %{latest_version: latest_version_note_blocks, changes: notes_blocks_changes} =
      Syncher.list_entities_changes(
        last_pulled_version,
        push_id,
        NoteBlock,
        vault_note_blocks_query(vault_id)
      )

    %{latest_version: latest_version_note_links, changes: note_links_changes} =
      Syncher.list_entities_changes(
        last_pulled_version,
        push_id,
        NoteLink,
        vault_note_links_query(vault_id)
      )

    latest_version =
      [
        last_pulled_version,
        latest_version_notes,
        latest_version_note_blocks,
        latest_version_note_links
      ]
      |> Enum.max()

    %{
      latest_version: latest_version,
      changes: %{
        notes: notes_changes,
        note_blocks: notes_blocks_changes,
        note_links: note_links_changes
      }
    }
  end

  defp vaults_query(user_id), do: from(u in Vault, where: u.user_id == ^user_id)

  defp vault_notes_query(vault_id), do: from(n in Note, where: n.vault_id == ^vault_id)

  defp vault_note_blocks_query(vault_id),
    do: from(n_b in NoteBlock, left_join: n in assoc(n_b, :note), where: n.vault_id == ^vault_id)

  defp vault_note_links_query(vault_id),
    do: from(n_b in NoteLink, left_join: n in assoc(n_b, :note), where: n.vault_id == ^vault_id)
end
