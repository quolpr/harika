import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { BaseSyncEntitiesService } from '../sync/syncEntities.service';
import { VaultEntityChangeSchema } from './schemas/vaultEntityChange.schema';

@Injectable()
export class VaultDbSyncEntitiesService extends BaseSyncEntitiesService {
  constructor(
    connection: Connection,
    @InjectRepository(VaultEntityChangeSchema)
    entityChangesRepo: Repository<VaultEntityChangeSchema>,
  ) {
    super(connection, entityChangesRepo);
  }
}
