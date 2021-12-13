import { injectable, inject } from 'inversify';
import {
  buffer,
  debounceTime,
  Observable,
  Subject,
  takeUntil,
  withLatestFrom,
} from 'rxjs';
import { DB_NAME } from '../../DbExtension/types';
import {
  ITransmittedChange,
  SyncRepository,
} from '../repositories/SyncRepository';
import { STOP_SIGNAL } from '../../../framework/types';
import { getBroadcastCh$ } from '../../../lib/utils';
import { BroadcastChannel } from 'broadcast-channel';

@injectable()
export class DbEventsSenderService {
  private onNewSyncPull: Subject<void> = new Subject();
  private eventsSubject: Subject<ITransmittedChange[]> = new Subject();
  private eventsChannel$: Observable<BroadcastChannel<unknown>>;
  private newSyncPullsChannel$: Observable<BroadcastChannel<unknown>>;

  constructor(
    @inject(DB_NAME) dbName: string,
    @inject(SyncRepository) private syncRepository: SyncRepository,
    @inject(STOP_SIGNAL) private stop$: Observable<void>,
  ) {
    this.eventsChannel$ = getBroadcastCh$(dbName);
    this.newSyncPullsChannel$ = getBroadcastCh$(`${dbName}_syncPull`);
  }

  initialize() {
    this.syncRepository.onChange((e) => this.eventsSubject.next(e));
    this.syncRepository.onNewSnapshots(() => this.onNewSyncPull.next());

    this.eventsSubject
      .pipe(
        buffer(this.eventsSubject.pipe(debounceTime(100))),
        withLatestFrom(this.eventsChannel$),
        takeUntil(this.stop$),
      )
      .subscribe(([evs, ch]) => {
        ch.postMessage(evs.flat());
      });

    this.onNewSyncPull
      .pipe(withLatestFrom(this.newSyncPullsChannel$), takeUntil(this.stop$))
      .subscribe(([, ch]) => ch.postMessage(''));
  }
}
