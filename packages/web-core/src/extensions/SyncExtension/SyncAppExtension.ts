import { injectable } from 'inversify';
import { BehaviorSubject, takeUntil } from 'rxjs';
import { STOP_SIGNAL } from '../../framework/types';
import { ServerSynchronizerFactory } from './serverSynchronizer/ServiceSynchronizerFactory';
import { SyncConfig } from './serverSynchronizer/SyncConfig';
import { DbEventsListenService } from './services/DbEventsListenerService';
import { OnDbChangeNotifier } from './synchronizer/OnDbChangeNotifier';
import { ToDbSynchronizer } from './synchronizer/ToDbSynchronizer';
import { SyncStateService } from './SyncState';
import { ROOT_STORE, SYNC_CONNECTION_ALLOWED } from './types';
import { BaseExtension } from '../../framework/BaseExtension';
import { ApplyChangesService } from './services/ApplyChangesService';
import { SyncRepository } from './repositories/SyncRepository';
import { DB_MIGRATIONS } from '../DbExtension/types';
import { initSyncTables } from './migrations/initSyncTables';
import { DbEventsSenderService } from './services/DbEventsSenderService';

@injectable()
export class SyncAppExtension extends BaseExtension {
  async register() {
    this.container.bind(ApplyChangesService).toSelf();
    this.container.bind(SyncRepository).toSelf();

    this.container.bind(DB_MIGRATIONS).toConstantValue(initSyncTables);

    this.container.bind(DbEventsListenService).toSelf();
    this.container.bind(SyncConfig).toSelf();
    this.container.bind(SyncStateService).toSelf();

    this.container
      .bind(SYNC_CONNECTION_ALLOWED)
      .toConstantValue(new BehaviorSubject(true));
  }

  async initialize() {
    this.container.resolve(OnDbChangeNotifier);
    this.container.resolve(DbEventsSenderService).initialize();
  }

  async onReady() {
    if (this.container.isBound(ROOT_STORE)) {
      this.container.resolve(ToDbSynchronizer);
    } else {
      console.info('no root store');
    }

    // Don't await to not block first render
    setTimeout(async () => {
      await this.container.resolve(ServerSynchronizerFactory).initialize();

      this.container
        .get(SyncStateService)
        .current$.pipe(takeUntil(this.container.get(STOP_SIGNAL)))
        .subscribe((state) => {
          console.log(
            `%c[${state.dbName}] New sync state: ${JSON.stringify(state)}`,
            'color:cyan;border:1px solid dodgerblue',
          );
        });
    }, 500);
  }
}
