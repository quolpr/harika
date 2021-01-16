import { Model, Relation } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
import {
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import { VaultTableNames } from '../schema';
import { NoteBlockRow } from './NoteBlockRow';
import { NoteRow } from './NoteRow';

export class NoteLinkRow extends Model {
  static table = VaultTableNames.NOTE_LINKS;

  static associations: Associations = {
    [VaultTableNames.NOTES]: { type: 'belongs_to', key: 'note_id' },
    [VaultTableNames.NOTE_BLOCKS]: {
      type: 'belongs_to',
      key: 'note_block_id',
    },
  };

  @relation(VaultTableNames.NOTES, 'note_id') note!: Relation<NoteRow>;
  @relation(VaultTableNames.NOTE_BLOCKS, 'note_block_id')
  noteBlock!: Relation<NoteBlockRow>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @field('note_id') noteId!: string;
  @field('note_block_id') noteBlockId!: string;
}
