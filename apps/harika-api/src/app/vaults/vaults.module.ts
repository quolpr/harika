import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule } from '../core/core.module';
import { SyncModule } from '../sync/sync.module';
import { Vault } from './models/vault.model';
import { VaultEntitySchema } from './schemas/vaultEntity.schema';
import { VaultEntityChangeSchema } from './schemas/vaultEntityChange.schema';
import { VaultDbSyncGateway } from './vaultDbSync.gateway';
import { VaultDbSyncEntitiesService } from './vaultDbSyncEntities.service';
import { VaultsResolver } from './vaults.resolver';
import { VaultsService } from './vaults.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VaultEntityChangeSchema,
      VaultEntitySchema,
      Vault,
    ]),
    CoreModule,
    SyncModule,
  ],
  providers: [
    VaultDbSyncEntitiesService,
    VaultsResolver,
    VaultsService,
    VaultDbSyncGateway,
  ],
})
export class VaultsModule {}
