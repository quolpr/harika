import { inject, injectable } from 'inversify';
import { BehaviorSubject, takeUntil } from 'rxjs';
import { BaseExtension } from '../../framework/BaseExtension';
import { RemoteRegister } from '../../framework/RemoteRegister';
import { STOP_SIGNAL } from '../../framework/types';
import { ApplyChangesService } from './persistence/ApplyChangesService';
import { SyncRepository } from './persistence/SyncRepository';
import { ServerSynchronizerFactory } from './serverSynchronizer/ServiceSynchronizerFactory';
import { SyncConfig } from './serverSynchronizer/SyncConfig';
import { DbEventsListenService } from './services/DbEventsListenerService';
import { OnDbChangeNotifier } from './synchronizer/OnDbChangeNotifier';
import { ToDbSynchronizer } from './synchronizer/ToDbSynchronizer';
import { SyncStateService } from './SyncState';
import { SYNC_CONNECTION_ALLOWED } from './types';

@injectable()
export class SyncAppExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    this.container.bind(DbEventsListenService).toSelf();
    this.container.bind(SyncConfig).toSelf();
    this.container.bind(SyncStateService).toSelf();

    this.container
      .bind(SYNC_CONNECTION_ALLOWED)
      .toConstantValue(new BehaviorSubject(true));

    await this.remoteRegister.registerRemote(SyncRepository);
    await this.remoteRegister.registerRemote(ApplyChangesService);
  }

  async initialize() {
    this.container.resolve(ToDbSynchronizer);
    this.container.resolve(OnDbChangeNotifier);
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
