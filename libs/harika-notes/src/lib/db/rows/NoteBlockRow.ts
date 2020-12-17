import { Model, Query, Relation } from '@nozbe/watermelondb';
import {
  children,
  date,
  field,
  json,
  relation,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import { NoteRow } from './NoteRow';
import { NoteRefRow } from './NoteRefRow';
import { HarikaNotesTableName } from '../schema';

export class NoteBlockRow extends Model {
  static table = HarikaNotesTableName.NOTE_BLOCKS;

  static associations: Associations = {
    [HarikaNotesTableName.NOTES]: { type: 'belongs_to', key: 'note_id' },
    [HarikaNotesTableName.NOTE_BLOCKS]: {
      type: 'has_many',
      foreignKey: 'parent_block_id',
    },
    [HarikaNotesTableName.NOTE_REFS]: {
      type: 'has_many',
      foreignKey: 'note_block_id',
    },
  };

  @relation(HarikaNotesTableName.NOTES, 'note_id') note!: Relation<NoteRow>;
  @relation(HarikaNotesTableName.NOTE_BLOCKS, 'parent_block_id')
  parentBlock!: Relation<NoteBlockRow>;
  @children(HarikaNotesTableName.NOTE_BLOCKS) childBlocks!: Query<NoteBlockRow>;
  @children(HarikaNotesTableName.NOTE_REFS) refs!: Query<NoteRefRow>;

  @field('note_id') noteId!: string;
  @field('parent_block_id') parentBlockId!: string | undefined;
  @field('content') content!: string;
  @field('order') order!: number;
  @json('child_block_ids', (data) => data) childBlockIds!: string[];
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
