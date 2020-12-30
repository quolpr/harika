import { Model, Query } from '@nozbe/watermelondb';
import {
  children,
  date,
  field,
  readonly,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import { HarikaNotesTableName } from '../schema';
import { NoteRow } from './NoteRow';

export class VaultRow extends Model {
  static table = HarikaNotesTableName.VAULT;

  static associations: Associations = {
    [HarikaNotesTableName.NOTES]: {
      type: 'has_many',
      foreignKey: 'note_id',
    },
    // [HarikaNotesTableName.NOTE_REFS]: {
    //   type: 'has_many',
    //   foreignKey: 'note_id',
    // },
  };

  @field('title') title!: string;
  @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children(HarikaNotesTableName.NOTES) notes!: Query<NoteRow>;
}
