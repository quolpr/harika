import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule } from '../core/core.module';
import { SyncModule } from '../sync/sync.module';
import { VaultEntityChangeSchema } from './schemas/vaultEntityChange.schema';
import { VaultDbSyncGateway } from './vaultDbSync.gateway';
import { VaultDbSyncEntitiesService } from './vaultDbSyncEntities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VaultEntityChangeSchema]),
    CoreModule,
    SyncModule,
  ],
  providers: [VaultDbSyncEntitiesService, VaultDbSyncGateway],
})
export class VaultsModule {}
