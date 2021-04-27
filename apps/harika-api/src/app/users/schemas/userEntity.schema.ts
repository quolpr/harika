import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EntitySchema } from '../../sync/types';
import { User } from './user.schema';

@Entity('user_entities')
export class UserEntitySchema implements EntitySchema {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  key!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'scopeId' })
  user!: User;

  @Column('uuid')
  @Index()
  scopeId!: string;

  @Column('json')
  obj!: Record<string, unknown>;
}
