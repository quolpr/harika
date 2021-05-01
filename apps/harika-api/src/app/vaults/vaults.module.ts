import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule } from '../core/core.module';
import { SyncModule } from '../sync/sync.module';
import { UserEntitySchema } from '../users/schemas/userEntity.schema';
import { VaultEntitySchema } from './schemas/vaultEntity.schema';
import { VaultEntityChangeSchema } from './schemas/vaultEntityChange.schema';
import { VaultDbSyncGateway } from './vaultDbSync.gateway';
import { VaultDbSyncEntitiesService } from './vaultDbSyncEntities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VaultEntityChangeSchema,
      VaultEntitySchema,
      UserEntitySchema,
    ]),
    CoreModule,
    SyncModule,
  ],
  providers: [VaultDbSyncEntitiesService, VaultDbSyncGateway],
})
export class VaultsModule {}
