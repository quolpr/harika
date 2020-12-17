import { Model, Relation } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
import {
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import { HarikaNotesTableName } from '../schema';
import { NoteBlockRow } from './NoteBlockRow';
import { NoteRow } from './NoteRow';

export class NoteRefRow extends Model {
  static table = HarikaNotesTableName.NOTE_REFS;

  static associations: Associations = {
    [HarikaNotesTableName.NOTES]: { type: 'belongs_to', key: 'note_id' },
    [HarikaNotesTableName.NOTE_BLOCKS]: {
      type: 'belongs_to',
      key: 'note_block_id',
    },
  };

  @relation(HarikaNotesTableName.NOTES, 'note_id') note!: Relation<NoteRow>;
  @relation(HarikaNotesTableName.NOTE_BLOCKS, 'note_block_id')
  noteBlock!: Relation<NoteBlockRow>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @field('note_id') noteId!: string;
  @field('note_block_id') noteBlockId!: string;
}
