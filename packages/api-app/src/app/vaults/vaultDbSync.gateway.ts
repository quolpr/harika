import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { TransientLogger } from '../core/TransientLogger';
import { SyncGateway } from '../sync/sync.gateway';
import { VaultDbSyncEntitiesService } from './vaultDbSyncEntities.service';

@Injectable()
@WebSocketGateway({ namespace: '/api/vault' })
export class VaultDbSyncGateway
  extends SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    entitiesService: VaultDbSyncEntitiesService,
    logger: TransientLogger,
  ) {
    super(entitiesService, logger);

    logger.setContext('VaultDBSyncGateway');
  }

  protected async auth(_vaultId: string, userId: string) {
    this.logger.debug(`[${userId}: Authed`);

    return true;
  }
}
