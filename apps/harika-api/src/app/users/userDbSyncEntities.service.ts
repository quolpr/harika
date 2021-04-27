import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { SyncEntitiesService } from '../sync/syncEntities.service';
import { UserEntitySchema } from './schemas/userEntity.schema';
import { UserEntityChangeSchema } from './schemas/userEntityChange.schema';

@Injectable()
export class UserDbSyncEntitiesService extends SyncEntitiesService {
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
