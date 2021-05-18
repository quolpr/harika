import { Entity, Unique } from 'typeorm';
import { BaseEntitySchema } from '../../sync/schemas/BaseEntity.schema';

@Entity('vaultEntities')
@Unique(['ownerId', 'scopeId', 'key'])
export class VaultEntitySchema extends BaseEntitySchema {}
