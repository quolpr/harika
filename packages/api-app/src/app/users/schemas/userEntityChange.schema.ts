import { Entity, Unique } from 'typeorm';
import { BaseEntityChangeSchema } from '../../sync/schemas/BaseEntityChange.schema';

@Entity('userEntityChanges')
@Unique(['ownerId', 'scopeId', 'table', 'rev'])
export class UserEntityChangeSchema extends BaseEntityChangeSchema {}
