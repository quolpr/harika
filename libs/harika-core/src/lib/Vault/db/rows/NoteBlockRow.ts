import { Model, Query, Relation } from '@nozbe/watermelondb';
import {
  children,
  date,
  field,
  json,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import { NoteRow } from './NoteRow';
import { NoteTableNames } from '../notesSchema';
import { NoteLinkRow } from './NoteLinkRow';

export class NoteBlockRow extends Model {
  static table = NoteTableNames.NOTE_BLOCKS;

  static associations: Associations = {
    [NoteTableNames.NOTES]: { type: 'belongs_to', key: 'note_id' },
    [NoteTableNames.NOTE_BLOCKS]: {
      type: 'has_many',
      foreignKey: 'parent_block_id',
    },
    [NoteTableNames.NOTE_LINKS]: {
      type: 'has_many',
      foreignKey: 'note_block_id',
    },
  };

  @relation(NoteTableNames.NOTES, 'note_id') note!: Relation<NoteRow>;
  @relation(NoteTableNames.NOTE_BLOCKS, 'parent_block_id')
  parentBlock!: Relation<NoteBlockRow>;
  @children(NoteTableNames.NOTE_BLOCKS) childBlocks!: Query<NoteBlockRow>;
  @children(NoteTableNames.NOTE_LINKS) links!: Query<NoteLinkRow>;

  @field('note_id') noteId!: string;
  @field('parent_block_id') parentBlockId!: string | undefined;
  @field('content') content!: string;
  @field('order_position') orderPosition!: number;
  // @json('linked_note_ids', (data) => data) linkedNoteIds!: string[];
  @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
