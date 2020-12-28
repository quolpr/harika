import { Model, Q, Query } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
import {
  children,
  date,
  field,
  json,
  lazy,
  readonly,
} from '@nozbe/watermelondb/decorators';
import { HarikaNotesTableName } from '../schema';
import { NoteBlockRow } from './NoteBlockRow';

export class NoteRow extends Model {
  static table = HarikaNotesTableName.NOTES;

  static associations: Associations = {
    [HarikaNotesTableName.NOTE_BLOCKS]: {
      type: 'has_many',
      foreignKey: 'note_id',
    },
    // [HarikaNotesTableName.NOTE_REFS]: {
    //   type: 'has_many',
    //   foreignKey: 'note_id',
    // },
  };

  @field('title') title!: string;
  @json('child_block_ids', (data) => data) childBlockIds!: string[];
  @json('linked_note_block_ids', (data) => data) linkedNoteBlockIds!: string[];
  @date('daily_note_date') dailyNoteDate!: Date | undefined;
  @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children(HarikaNotesTableName.NOTE_BLOCKS) noteBlocks!: Query<NoteBlockRow>;
  // @children(HarikaNotesTableName.NOTE_REFS) refs!: Query<NoteRefRow>;

  @lazy
  childNoteBlocks = this.noteBlocks.extend(
    Q.where('parent_block_id', Q.eq(null))
  );
}
