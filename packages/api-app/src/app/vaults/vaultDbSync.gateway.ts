import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Repository } from 'typeorm';
import { TransientLogger } from '../core/TransientLogger';
import { ClientIdentityService } from '../sync/clientIdentity.service';
import { SyncGateway } from '../sync/sync.gateway';
import { UserEntitySchema } from '../users/schemas/userEntity.schema';
import { VaultDbSyncEntitiesService } from './vaultDbSyncEntities.service';

@Injectable()
@WebSocketGateway({ namespace: '/api/vault' })
export class VaultDbSyncGateway
  extends SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    entitiesService: VaultDbSyncEntitiesService,
    logger: TransientLogger,
    identityService: ClientIdentityService,
    @InjectRepository(UserEntitySchema)
    private userEntitiesRepo: Repository<UserEntitySchema>
  ) {
    super(entitiesService, logger, identityService);

    logger.setContext('VaultDBSyncGateway');
  }

  protected async auth(vaultId: string, userId: string) {
    this.logger.debug(`[${userId}: Authed`);

    return Boolean(
      (await this.userEntitiesRepo.findOne({
        key: vaultId,
        ownerId: userId,
      })) ||
        // if not created yet
        !(await this.userEntitiesRepo.findOne({ key: vaultId }))
    );
  }
}
