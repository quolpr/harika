import { injectable, inject } from 'inversify';
import { buffer, debounceTime, Subject } from 'rxjs';
import { DB_NAME } from '../../DbExtension/types';
import {
  ITransmittedChange,
  SyncRepository,
} from '../persistence/SyncRepository';
import { BroadcastChannel } from 'broadcast-channel';

@injectable()
export class DbEventsSenderService {
  private onNewSyncPull: Subject<void> = new Subject();
  private eventsSubject: Subject<ITransmittedChange[]> = new Subject();
  eventsChannel: BroadcastChannel<unknown>;
  newSyncPullsChannel: BroadcastChannel<unknown>;

  constructor(
    @inject(DB_NAME) dbName: string,
    @inject(SyncRepository) private syncRepository: SyncRepository,
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
      .pipe(buffer(this.eventsSubject.pipe(debounceTime(200))))
      .subscribe((evs) => {
        this.eventsChannel.postMessage(evs.flat());
      });

    this.onNewSyncPull.subscribe(() =>
      this.newSyncPullsChannel.postMessage(''),
    );
  }
}
