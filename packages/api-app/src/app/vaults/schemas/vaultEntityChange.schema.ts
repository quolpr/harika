import { Entity, Unique } from 'typeorm';
import { BaseEntityChangeSchema } from '../../sync/schemas/BaseEntityChange.schema';

@Entity('vaultEntityChanges')
@Unique(['ownerId', 'scopeId', 'table', 'rev'])
export class VaultEntityChangeSchema extends BaseEntityChangeSchema {}
