import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  ],
  providers: [
    VaultDbSyncEntitiesService,
    VaultsResolver,
    VaultsService,
    VaultDbSyncGateway,
  ],
})
export class VaultsModule {}
