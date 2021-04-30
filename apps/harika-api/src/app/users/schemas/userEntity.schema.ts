import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  Unique,
} from 'typeorm';
import { EntitySchema } from '../../sync/types';
import { User } from './user.schema';

@Entity('userEntities')
@Unique(['ownerId', 'scopeId', 'key'])
export class UserEntitySchema implements EntitySchema {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  key!: string;

  @Column()
  @Index()
  scopeId!: string;

  @Column('uuid')
  @Index()
  ownerId!: string;

  @ManyToOne(() => User)
  owner!: User;

  @Column('json')
  obj!: Record<string, unknown>;
}
