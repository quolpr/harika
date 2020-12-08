import { Model, Query, Relation } from '@nozbe/watermelondb';
import {
  children,
  date,
  field,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Note from './Note';
import { TableName } from './schema';

export default class NoteBlock extends Model {
  static table = TableName.NOTE_BLOCKS;

  static associations: Associations = {
    notes: { type: 'belongs_to', key: 'note_id' },
    note_blocks: { type: 'has_many', foreignKey: 'parent_block_id' },
  };

  @relation(TableName.NOTES, 'note_id') note!: Relation<Note>;
  @relation(TableName.NOTE_BLOCKS, 'parent_block_id') parentBlock!: Relation<
    NoteBlock
  >;
  @children(TableName.NOTE_BLOCKS) childBlocks!: Query<NoteBlock>;

  @field('note_id') note_id!: string;
  @field('parent_block_id') parent_block_id!: string;
  @field('content') content!: string;
  @field('order') order!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
