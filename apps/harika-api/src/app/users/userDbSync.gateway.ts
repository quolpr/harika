import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { SyncGateway } from '../sync/sync.gateway';
import { UserDbSyncEntitiesService } from './userDbSyncEntities.service';

@Injectable()
@WebSocketGateway({ namespace: '/api/user' })
export class UserDbSyncGateway
  extends SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(entitiesService: UserDbSyncEntitiesService) {
    super(entitiesService);
  }
}
