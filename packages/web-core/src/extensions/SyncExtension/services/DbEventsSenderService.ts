import { injectable, inject } from 'inversify';
import { buffer, debounceTime, Observable, Subject, takeUntil } from 'rxjs';
import { DB_NAME } from '../../DbExtension/types';
import {
  ITransmittedChange,
  SyncRepository,
} from '../persistence/SyncRepository';
import { BroadcastChannel } from 'broadcast-channel';
import { STOP_SIGNAL } from '../../../framework/types';

@injectable()
export class DbEventsSenderService {
  private onNewSyncPull: Subject<void> = new Subject();
  private eventsSubject: Subject<ITransmittedChange[]> = new Subject();
  private eventsChannel: BroadcastChannel<unknown>;
  private newSyncPullsChannel: BroadcastChannel<unknown>;

  constructor(
    @inject(DB_NAME) dbName: string,
    @inject(SyncRepository) private syncRepository: SyncRepository,
    @inject(STOP_SIGNAL) private stop$: Observable<void>,
  ) {
    this.eventsChannel = new BroadcastChannel(dbName, {
      webWorkerSupport: true,
    });
    this.newSyncPullsChannel = new BroadcastChannel(`${dbName}_syncPull`, {
      webWorkerSupport: true,
    });
  }

  initialize() {
    this.syncRepository.onChange((e) => this.eventsSubject.next(e));
    this.syncRepository.onNewPull(() => this.onNewSyncPull.next());

    this.eventsSubject
      .pipe(
        buffer(this.eventsSubject.pipe(debounceTime(200))),
        takeUntil(this.stop$),
      )
      .subscribe((evs) => {
        this.eventsChannel.postMessage(evs.flat());
      });

    this.onNewSyncPull
      .pipe(takeUntil(this.stop$))
      .subscribe(() => this.newSyncPullsChannel.postMessage(''));
  }
}
