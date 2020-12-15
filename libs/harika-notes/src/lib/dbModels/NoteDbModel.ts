import { Model, Q, Query } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
import {
  children,
  date,
  field,
  lazy,
  readonly,
} from '@nozbe/watermelondb/decorators';
import { HarikaNotesTableName } from './schema';
import { NoteBlockDbModel } from './NoteBlockDbModel';
import { NoteRefDbModel } from './NoteRefDbModel';

export class NoteDbModel extends Model {
  static table = HarikaNotesTableName.NOTES;

  static associations: Associations = {
    [HarikaNotesTableName.NOTE_BLOCKS]: {
      type: 'has_many',
      foreignKey: 'note_id',
    },
    [HarikaNotesTableName.NOTE_REFS]: {
      type: 'has_many',
      foreignKey: 'note_id',
    },
  };

  @field('title') title!: string;
  @date('daily_note_date') dailyNoteDate!: Date | undefined;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children(HarikaNotesTableName.NOTE_BLOCKS) noteBlocks!: Query<
    NoteBlockDbModel
  >;
  @children(HarikaNotesTableName.NOTE_REFS) refs!: Query<NoteRefDbModel>;

  @lazy
  childNoteBlocks = this.noteBlocks.extend(
    Q.where('parent_block_id', Q.eq(null))
  );

  @lazy
  backlinkedBlocks = this.collections
    .get<NoteBlockDbModel>(HarikaNotesTableName.NOTE_BLOCKS)
    .query(Q.on(HarikaNotesTableName.NOTE_REFS, 'note_id', this.id));
}
