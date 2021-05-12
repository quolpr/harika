import { Entity } from 'typeorm';
import { BaseEntityChangeSchema } from '../../sync/schemas/BaseEntityChange.schema';

@Entity('vaultEntityChanges')
export class VaultEntityChangeSchema extends BaseEntityChangeSchema {}
