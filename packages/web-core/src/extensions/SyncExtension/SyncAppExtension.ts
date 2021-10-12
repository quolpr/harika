import { BaseExtension } from '../../framework/BaseExtension';
import { SyncConfig } from './serverSynchronizer/SyncConfig';
import { DbEventsListenService } from './services/DbEventsListenerService';
import { OnDbChangeNotifier } from './synchronizer/OnDbChangeNotifier';
import { ToDbSynchronizer } from './synchronizer/ToDbSynchronizer';

export class SyncAppExtension extends BaseExtension {
  async register() {
    this.container.bind(DbEventsListenService).toSelf();
    this.container.bind(SyncConfig).toSelf();
  }

  async initialize() {
    this.container.resolve(ToDbSynchronizer);
    this.container.resolve(OnDbChangeNotifier);
  }
}
