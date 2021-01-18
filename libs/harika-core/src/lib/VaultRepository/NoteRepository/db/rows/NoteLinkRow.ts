import { Model, Relation } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
import {
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import { NoteTableNames } from '../notesSchema';
import { NoteBlockRow } from './NoteBlockRow';
import { NoteRow } from './NoteRow';

export class NoteLinkRow extends Model {
  static table = NoteTableNames.NOTE_LINKS;

  static associations: Associations = {
    [NoteTableNames.NOTES]: { type: 'belongs_to', key: 'note_id' },
    [NoteTableNames.NOTE_BLOCKS]: {
      type: 'belongs_to',
      key: 'note_block_id',
    },
  };

  @relation(NoteTableNames.NOTES, 'note_id') note!: Relation<NoteRow>;
  @relation(NoteTableNames.NOTE_BLOCKS, 'note_block_id')
  noteBlock!: Relation<NoteBlockRow>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @field('note_id') noteId!: string;
  @field('note_block_id') noteBlockId!: string;
}
