import { proxy } from 'comlink';
import type { ProxyMarked } from 'comlink';
import { Subject, buffer, debounceTime, withLatestFrom } from 'rxjs';
import { DB } from '../../DbExtension/DB';
import type { ApplyChangesService } from './ApplyChangesService';
import type { ITransmittedChange } from './SyncRepository';
import { SyncRepository } from './SyncRepository';
import type { IInternalSyncCtx } from './syncCtx';
import { isEqual } from 'lodash-es';
import { suppressLog } from '../../DbExtension/suppressLog';
import { IMigration } from '../../DbExtension/types';
import { getBroadcastCh$ } from '../../../lib/utils';

export abstract class BaseDbSyncWorker {
  protected db!: DB<IInternalSyncCtx>;
  protected syncRepo!: SyncRepository;
  protected eventsSubject$: Subject<ITransmittedChange[]> = new Subject();
  protected onNewSyncPull$: Subject<void> = new Subject();

  constructor(protected dbName: string, protected windowId: string) {
    const eventsChannel$ = getBroadcastCh$(this.dbName);

    this.eventsSubject$
      .pipe(
        buffer(this.eventsSubject$.pipe(debounceTime(200))),
        withLatestFrom(eventsChannel$),
      )
      .subscribe(([evs, ch]) => {
        ch.postMessage(evs.flat());
      });

    const newSyncPullsChannel$ = getBroadcastCh$(`${this.dbName}_syncPull`);

    this.onNewSyncPull$
      .pipe(withLatestFrom(newSyncPullsChannel$))
      .subscribe(([, ch]) => ch.postMessage(''));
  }

  async initialize() {
    if (!this.db) {
      this.db = new DB(this.dbName);
      await this.db.init(this.migrations());

      this.syncRepo = new SyncRepository(this.db);

      this.syncRepo.onChange((e) => {
        this.eventsSubject$.next(e);
      });

      this.syncRepo.onNewPull(() => this.onNewSyncPull$.next());
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
