import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { TransientLogger } from '../core/TransientLogger';
import { ClientIdentityService } from '../sync/clientIdentity.service';
import { SyncGateway } from '../sync/sync.gateway';
import { UserDbSyncEntitiesService } from './userDbSyncEntities.service';

@Injectable()
@WebSocketGateway({ namespace: '/api/user' })
export class UserDbSyncGateway
  extends SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    entitiesService: UserDbSyncEntitiesService,
    logger: TransientLogger,
    identityService: ClientIdentityService
  ) {
    logger.setContext('UserDBSyncGateway');
    super(entitiesService, logger, identityService);
  }

  protected async auth(scopeId: string, userId: string) {
    return scopeId === userId;
  }
}
