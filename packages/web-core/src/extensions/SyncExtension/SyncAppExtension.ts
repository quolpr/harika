import { injectable } from 'inversify';
import { BehaviorSubject, takeUntil } from 'rxjs';
import { STOP_SIGNAL } from '../../framework/types';
import { ServerSynchronizerFactory } from './app/serverSynchronizer/ServiceSynchronizerFactory';
import { SyncConfig } from './app/serverSynchronizer/SyncConfig';
import { DbEventsListenService } from './app/services/DbEventsListenerService';
import { OnDbChangeNotifier } from './app/synchronizer/OnDbChangeNotifier';
import { ToDbSynchronizer } from './app/synchronizer/ToDbSynchronizer';
import { SyncStateService } from './app/SyncState';
import { SYNC_CONNECTION_ALLOWED } from './types';
import { BaseExtension } from '../../framework/BaseExtension';
import { ApplyChangesService } from './worker/services/ApplyChangesService';
import { SyncRepository } from './worker/repositories/SyncRepository';
import { DB_MIGRATIONS } from '../DbExtension/types';
import { initSyncTables } from './worker/migrations/initSyncTables';
import { DbEventsSenderService } from './worker/services/DbEventsSenderService';

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
    this.container.resolve(ToDbSynchronizer);
    this.container.resolve(OnDbChangeNotifier);
    this.container.resolve(DbEventsSenderService).initialize();
  }

  async onReady() {
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
