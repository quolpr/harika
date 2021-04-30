import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  Unique,
} from 'typeorm';
import { EntitySchema } from '../../sync/types';
import { User } from '../../users/schemas/user.schema';

@Entity('vaultEntities')
@Unique(['ownerId', 'scopeId', 'key'])
export class VaultEntitySchema implements EntitySchema {
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
