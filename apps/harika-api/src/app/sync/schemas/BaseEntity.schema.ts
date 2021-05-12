import {
  Column,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/schemas/user.schema';
import { EntitySchema } from '../types';

@Unique(['ownerId', 'scopeId', 'key'])
export abstract class BaseEntitySchema implements EntitySchema {
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
