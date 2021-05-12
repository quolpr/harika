import { Entity } from 'typeorm';
import { BaseEntitySchema } from '../../sync/schemas/BaseEntity.schema';

@Entity('vaultEntities')
export class VaultEntitySchema extends BaseEntitySchema {}
