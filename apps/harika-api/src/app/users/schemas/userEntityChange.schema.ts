import { Entity } from 'typeorm';
import { BaseEntityChangeSchema } from '../../sync/schemas/BaseEntityChange.schema';

@Entity('userEntityChanges')
export class UserEntityChangeSchema extends BaseEntityChangeSchema {}
