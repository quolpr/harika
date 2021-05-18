import {
  Column,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/schemas/user.schema';
import type { EntityChangeSchema } from '../types';
import { DatabaseChangeType, IDatabaseChange } from '@harika/core';

@Unique(['ownerId', 'scopeId', 'table', 'rev'])
export abstract class BaseEntityChangeSchema implements EntityChangeSchema {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  rev!: number;

  @Column()
  @Index()
  scopeId!: string;

  @Column('uuid')
  @Index()
  ownerId!: string;

  @ManyToOne(() => User)
  owner!: User;

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
        source: this.source,
      };
    } else if (this.type === DatabaseChangeType.Update) {
      if (!this.mods) throw new Error('No mods!');

      return {
        type: DatabaseChangeType.Update,
        table: this.table,
        key: this.key,
        mods: this.mods,
        source: this.source,
        obj: this.obj,
      };
    } else {
      if (!this.obj) throw new Error('No obj!');

      return {
        type: DatabaseChangeType.Create,
        table: this.table,
        key: this.key,
        obj: this.obj,
        source: this.source,
      };
    }
  }
}
