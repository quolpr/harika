import { Model, Relation } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
import {
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import { HarikaNotesTableName } from './schema';
import { NoteBlock } from './NoteBlock';
import { Note } from './Note';

export class NoteRef extends Model {
  static table = HarikaNotesTableName.NOTE_REFS;

  static associations: Associations = {
    [HarikaNotesTableName.NOTES]: { type: 'belongs_to', key: 'note_id' },
    [HarikaNotesTableName.NOTE_BLOCKS]: {
      type: 'belongs_to',
      key: 'note_block_id',
    },
  };

  @relation(HarikaNotesTableName.NOTES, 'note_id') note!: Relation<Note>;
  @relation(HarikaNotesTableName.NOTE_BLOCKS, 'note_block_id')
  noteBlock!: Relation<NoteBlock>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @field('note_id') noteId!: string;
  @field('note_block_id') noteBlockId!: string;
}