import { Model, Query, Relation } from '@nozbe/watermelondb';
import {
  children,
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import { NoteDbModel } from './NoteDbModel';
import { NoteRefDbModel } from './NoteRefDbModel';
import { HarikaNotesTableName } from '../schema';

export class NoteBlockDbModel extends Model {
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

  @relation(HarikaNotesTableName.NOTES, 'note_id') note!: Relation<NoteDbModel>;
  @relation(HarikaNotesTableName.NOTE_BLOCKS, 'parent_block_id')
  parentBlock!: Relation<NoteBlockDbModel>;
  @children(HarikaNotesTableName.NOTE_BLOCKS) childBlocks!: Query<
    NoteBlockDbModel
  >;
  @children(HarikaNotesTableName.NOTE_REFS) refs!: Query<NoteRefDbModel>;

  @field('note_id') noteId!: string;
  @field('parent_block_id') parentBlockId!: string | undefined;
  @field('content') content!: string;
  @field('order') order!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
