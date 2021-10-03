import { proxy } from 'comlink';
import type { ProxyMarked } from 'comlink';
import { Subject, buffer, debounceTime } from 'rxjs';
import { DB } from '../../core/DB';
import type { ApplyChangesService } from './ApplyChangesService';
import type { ITransmittedChange } from './SyncRepository';
import { SyncRepository } from './SyncRepository';
import { BroadcastChannel } from 'broadcast-channel';
import type { IInternalSyncCtx } from './syncCtx';
import { isEqual } from 'lodash-es';
import { suppressLog } from '../../core/suppressLog';
import { IMigration } from '../../core/types';

export abstract class BaseDbSyncWorker {
  protected db!: DB<IInternalSyncCtx>;
  protected syncRepo!: SyncRepository;
  protected eventsSubject$: Subject<ITransmittedChange[]> = new Subject();
  protected onNewSyncPull$: Subject<void> = new Subject();

  constructor(protected dbName: string, protected windowId: string) {
    const eventsChannel = new BroadcastChannel(this.dbName, {
      webWorkerSupport: true,
    });

    this.eventsSubject$
      .pipe(buffer(this.eventsSubject$.pipe(debounceTime(200))))
      .subscribe((evs) => {
        eventsChannel.postMessage(evs.flat());
      });

    const newSyncPullsChannel = new BroadcastChannel(
      `${this.dbName}_syncPull`,
      {
        webWorkerSupport: true,
      },
    );
    this.onNewSyncPull$.subscribe(() => newSyncPullsChannel.postMessage(''));
  }

  async initialize() {
    if (!this.db) {
      this.db = new DB();
      await this.db.init(this.dbName, this.migrations());

      this.syncRepo = new SyncRepository(
        this.db,
        (e) => {
          this.eventsSubject$.next(e);
        },
        () => this.onNewSyncPull$.next(),
      );
    }
  }

  getSyncRepo() {
    return proxy(this.syncRepo);
  }

  isHealthOk() {
    const [result] = suppressLog(() =>
      this.db.sqlExec('SELECT id, isOk FROM health_check;'),
    );

    return isEqual(result.values, [[1, 1]]);
  }

  abstract getApplyChangesService(): ApplyChangesService & ProxyMarked;

  abstract migrations(): IMigration[];
}
