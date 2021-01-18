import { appSchema, tableSchema } from '@nozbe/watermelondb';

export enum NoteTableNames {
  NOTES = 'notes',
  NOTE_BLOCKS = 'note_blocks',
  NOTE_LINKS = 'note_links',
}

export const notesSchema = appSchema({
  version: 39,
  tables: [
    tableSchema({
      name: NoteTableNames.NOTES,
      columns: [
        { name: 'title', type: 'string', isIndexed: true },
        { name: 'linked_note_block_ids', type: 'string' },
        {
          name: 'daily_note_date',
          type: 'number',
          isIndexed: true,
          isOptional: true,
        },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: NoteTableNames.NOTE_LINKS,
      columns: [
        { name: 'note_id', type: 'string', isIndexed: true },
        { name: 'note_block_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: NoteTableNames.NOTE_BLOCKS,
      columns: [
        {
          name: 'parent_block_id',
          type: 'string',
          isOptional: true,
          isIndexed: true,
        },
        { name: 'linked_note_ids', type: 'string' },
        { name: 'note_id', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'order_position', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
