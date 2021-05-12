import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { BaseSyncEntitiesService } from '../sync/syncEntities.service';
import { VaultEntitySchema } from './schemas/vaultEntity.schema';
import { VaultEntityChangeSchema } from './schemas/vaultEntityChange.schema';

@Injectable()
export class VaultDbSyncEntitiesService extends BaseSyncEntitiesService {
  constructor(
    connection: Connection,
    @InjectRepository(VaultEntitySchema)
    vaultEntitiesRepo: Repository<VaultEntitySchema>,
    @InjectRepository(VaultEntityChangeSchema)
    entityChangesRepo: Repository<VaultEntityChangeSchema>
  ) {
    super(connection, vaultEntitiesRepo, entityChangesRepo);
  }
}