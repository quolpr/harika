import { injectable } from 'inversify';
import { BehaviorSubject, takeUntil } from 'rxjs';

import { BaseExtension } from '../../framework/BaseExtension';
import { STOP_SIGNAL } from '../../framework/types';
import { DB_MIGRATIONS } from '../DbExtension/types';
import { initSyncTables } from './migrations/initSyncTables';
import { trackChangesPipeCtx } from './mobx-keystone/trackChanges';
import { SyncRepository } from './repositories/SyncRepository';
import { ServerSynchronizerFactory } from './serverSynchronizer/ServiceSynchronizerFactory';
import { SyncConfig } from './serverSynchronizer/SyncConfig';
import { DbEventsListenService } from './services/DbEventsListenerService';
import { DbEventsSenderService } from './services/DbEventsSenderService';
import { OnDbChangeNotifier } from './services/OnDbChangeNotifier';
import { SnapshotsApplier } from './services/SnapshotsApplier';
import { SyncStatusService } from './services/SyncStatusService';
import { ToDbSynchronizer } from './services/ToDbSynchronizer';
import { SyncStateService } from './SyncState';
import {
  ISyncConflictResolver,
  MODELS_CHANGES_PIPE,
  ROOT_STORE,
  SYNC_CONFLICT_RESOLVER,
  SYNC_CONNECTION_ALLOWED,
} from './types';

// Otherwise inversify will be throwing "No matching bindings found for serviceIdentifier"
class DumbSyncConflictResolver implements ISyncConflictResolver {
  get collectionNamesToResolve() {
    return 'any' as const;
  }

  async resolve() {}
}

@injectable()
export class SyncAppExtension extends BaseExtension {
  async register() {
    this.container.bind(SyncRepository).toSelf();

    this.container.bind(DB_MIGRATIONS).toConstantValue(initSyncTables);

    this.container.bind(DbEventsListenService).toSelf();
    this.container.bind(SyncConfig).toSelf();
    this.container.bind(SyncStateService).toSelf();
    this.container.bind(SyncStatusService).toSelf();

    this.container
      .bind(SYNC_CONNECTION_ALLOWED)
      .toConstantValue(new BehaviorSubject(true));

    this.container
      .bind(SYNC_CONFLICT_RESOLVER)
      .toConstantValue(new DumbSyncConflictResolver());
    this.container
      .bind(MODELS_CHANGES_PIPE)
      .toDynamicValue(() =>
        trackChangesPipeCtx.get(this.container.get(ROOT_STORE)),
      );
  }

  async initialize() {
    this.container.resolve(OnDbChangeNotifier);
    this.container.resolve(DbEventsSenderService).initialize();
    this.container.resolve(SnapshotsApplier).start();
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
