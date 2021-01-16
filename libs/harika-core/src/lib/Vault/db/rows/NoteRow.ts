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
import { VaultTableNames } from '../schema';
import { NoteBlockRow } from './NoteBlockRow';
import { NoteLinkRow } from './NoteLinkRow';

export class NoteRow extends Model {
  static table = VaultTableNames.NOTES;

  static associations: Associations = {
    [VaultTableNames.NOTE_BLOCKS]: {
      type: 'has_many',
      foreignKey: 'note_id',
    },
    [VaultTableNames.NOTE_LINKS]: {
      type: 'has_many',
      foreignKey: 'note_id',
    },
  };

  @field('title') title!: string;
  // @json('linked_note_block_ids', (data) => data) linkedNoteBlockIds!: string[];
  @date('daily_note_date') dailyNoteDate!: Date | undefined;
  @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children(VaultTableNames.NOTE_BLOCKS) noteBlocks!: Query<NoteBlockRow>;
  @children(VaultTableNames.NOTE_LINKS) links!: Query<NoteLinkRow>;

  @lazy
  linkedNoteBlocks = this.collections
    .get(VaultTableNames.NOTE_BLOCKS)
    .query(Q.on(VaultTableNames.NOTE_LINKS, 'note_id', this.id));

  @lazy
  childNoteBlocks = this.noteBlocks.extend(
    Q.where('parent_block_id', Q.eq(null))
  );
}
