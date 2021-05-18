import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { BaseSyncEntitiesService } from '../sync/syncEntities.service';
import { UserEntitySchema } from './schemas/userEntity.schema';
import { UserEntityChangeSchema } from './schemas/userEntityChange.schema';

@Injectable()
export class UserDbSyncEntitiesService extends BaseSyncEntitiesService {
  constructor(
    connection: Connection,
    @InjectRepository(UserEntitySchema)
    entitiesRepo: Repository<UserEntitySchema>,
    @InjectRepository(UserEntityChangeSchema)
    entityChangesRepo: Repository<UserEntityChangeSchema>
  ) {
    super(connection, entitiesRepo, entityChangesRepo);
  }
}
