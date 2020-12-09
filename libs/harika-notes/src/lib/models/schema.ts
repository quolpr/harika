import Note from './Note';
import NoteBlock from './NoteBlock';
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export enum HarikaNotesTableName {
  NOTES = 'notes',
  NOTE_BLOCKS = 'note_blocks',
}

export default appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: HarikaNotesTableName.NOTES,
      columns: [
        { name: 'title', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: HarikaNotesTableName.NOTE_BLOCKS,
      columns: [
        {
          name: 'parent_block_id',
          type: 'string',
          isOptional: true,
          isIndexed: true,
        },
        { name: 'note_id', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'order', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
