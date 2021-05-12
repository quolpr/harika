import { Entity } from 'typeorm';
import { BaseEntitySchema } from '../../sync/schemas/BaseEntity.schema';

@Entity('userEntities')
export class UserEntitySchema extends BaseEntitySchema {}
