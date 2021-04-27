import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { SyncGateway } from '../sync/sync.gateway';
import { VaultDbSyncEntitiesService } from './vaultDbSyncEntities.service';

@Injectable()
@WebSocketGateway({ namespace: '/vault' })
export class VaultDbSyncGateway
  extends SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(entitiesService: VaultDbSyncEntitiesService) {
    super(entitiesService);
  }
}
