import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Vault } from '../models/vault.model';
import { EntitySchema } from '../../sync/types';

@Entity('vault_entities')
export class VaultEntitySchema implements EntitySchema {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  key!: string;

  @ManyToOne(() => Vault)
  @JoinColumn({ name: 'scopeId' })
  vault!: Vault;

  @Column('uuid')
  @Index()
  scopeId!: string;

  @Column('json')
  obj!: Record<string, unknown>;
}
