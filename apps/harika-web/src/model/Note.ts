import { Collection, Model, Q, Query } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
import {
  children,
  date,
  field,
  lazy,
  readonly,
} from '@nozbe/watermelondb/decorators';
import { TableName } from './schema';
import NoteBlock from './NoteBlock';

export default class Note extends Model {
  static table = TableName.NOTES;

  static associations: Associations = {
    note_blocks: { type: 'has_many', foreignKey: 'note_id' },
  };

  @field('title') title!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children(TableName.NOTE_BLOCKS) noteBlocks!: Query<NoteBlock>;

  @lazy
  childNoteBlocks = this.noteBlocks.extend(
    Q.where('parent_block_id', Q.eq(null))
  );
}
