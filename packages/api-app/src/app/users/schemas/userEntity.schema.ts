import { Entity, Unique } from 'typeorm';
import { BaseEntitySchema } from '../../sync/schemas/BaseEntity.schema';

@Entity('userEntities')
@Unique(['ownerId', 'scopeId', 'key'])
export class UserEntitySchema extends BaseEntitySchema {}
