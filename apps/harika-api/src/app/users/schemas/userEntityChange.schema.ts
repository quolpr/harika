import {
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  EntityChangeSchema,
  DatabaseChangeType,
  IDatabaseChange,
} from '../../sync/types';
import { User } from './user.schema';

@Entity('user_entity_changes')
@Unique(['scopeId', 'table', 'rev'])
export class UserEntityChangeSchema implements EntityChangeSchema {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  rev!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'scopeId' })
  user!: User;

  @Column('uuid')
  @Index()
  scopeId!: string;

  @Column()
  source!: string;

  @Column('int')
  type!: DatabaseChangeType;

  @Column()
  @Index()
  table!: string;

  @Column()
  @Index()
  key!: string;

  @Column('json', { nullable: true })
  obj?: Record<string, unknown>;

  @Column('json', { nullable: true })
  mods?: Record<string, unknown>;

  toChange(): IDatabaseChange {
    if (this.type === DatabaseChangeType.Delete) {
      return {
        type: DatabaseChangeType.Delete,
        table: this.table,
        key: this.key,
      };
    } else if (this.type === DatabaseChangeType.Update) {
      if (!this.mods) throw new Error('No mods!');

      return {
        type: DatabaseChangeType.Update,
        table: this.table,
        key: this.key,
        mods: this.mods,
      };
    } else {
      if (!this.obj) throw new Error('No obj!');

      return {
        type: DatabaseChangeType.Create,
        table: this.table,
        key: this.key,
        obj: this.obj,
      };
    }
  }
}
