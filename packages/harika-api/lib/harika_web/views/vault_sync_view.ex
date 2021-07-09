defmodule HarikaWeb.VaultSyncView do
  use HarikaWeb, :view

  def render("push.json", %{push: push}) do
    render("pull.json", %{pull: push})
  end

  def render("pull.json", %{pull: pull}) do
    %{
      changes: %{
        note_blocks: %{
          created:
            render_many(pull.changes.note_blocks.created, __MODULE__, "note_block.json",
              as: :note_block
            ),
          updated:
            render_many(pull.changes.note_blocks.updated, __MODULE__, "note_block.json",
              as: :note_block
            ),
          deleted: pull.changes.note_blocks.deleted
        },
        notes: %{
          created: render_many(pull.changes.notes.created, __MODULE__, "note.json", as: :note),
          updated: render_many(pull.changes.notes.updated, __MODULE__, "note.json", as: :note),
          deleted: pull.changes.notes.deleted
        },
        note_links: %{
          created:
            render_many(pull.changes.note_links.created, __MODULE__, "note_link.json",
              as: :note_link
            ),
          updated:
            render_many(pull.changes.note_links.updated, __MODULE__, "note_link.json",
              as: :note_link
            ),
          deleted: pull.changes.note_links.deleted
        }
      },
      latestVersion: pull.latest_version
    }
  end

  def render("note.json", %{note: note}) do
    %{
      id: note.id,
      daily_note_date: note.daily_note_date |> DateTime.to_unix(:millisecond),
      title: note.title,
      created_at: note.created_at |> DateTime.to_unix(:millisecond)
    }
  end

  def render("note_block.json", %{note_block: note_block}) do
    %{
      id: note_block.id,
      content: note_block.content,
      note_id: note_block.note_id,
      parent_block_id: note_block.parent_block_id,
      order_position: note_block.order_position,
      created_at: note_block.created_at |> DateTime.to_unix(:millisecond)
    }
  end

  def render("note_link.json", %{note_link: note_link}) do
    %{
      id: note_link.id,
      note_id: note_link.note_id,
      note_block_id: note_link.note_block_id,
      created_at: note_link.created_at |> DateTime.to_unix(:millisecond)
    }
  end
end
