import { BaseExtension } from '../../framework/BaseExtension';
import { DbEventsListenService } from './services/DbEventsListenerService';

export class SyncAppExtension extends BaseExtension {
  async register() {
    this.container.bind(DbEventsListenService).toSelf();
  }
}
