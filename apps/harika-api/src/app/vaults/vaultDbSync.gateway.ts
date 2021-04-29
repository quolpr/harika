import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { TransientLogger } from '../core/TransientLogger';
import { ClientIdentityService } from '../sync/clientIdentity.service';
import { SyncGateway } from '../sync/sync.gateway';
import { VaultDbSyncEntitiesService } from './vaultDbSyncEntities.service';

@Injectable()
@WebSocketGateway({ namespace: '/api/vault' })
export class VaultDbSyncGateway
  extends SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    entitiesService: VaultDbSyncEntitiesService,
    logger: TransientLogger,
    identityService: ClientIdentityService
  ) {
    logger.setContext('VaultDBSyncGateway');
    super(entitiesService, logger, identityService);
  }
}
