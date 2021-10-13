import { initSyncTables } from './migrations/initSyncTables';
import { BaseExtension } from '../../framework/BaseExtension';
import { SyncRepository } from './persistence/SyncRepository';
import { DB_MIGRATIONS } from '../DbExtension/types';
import { DbEventsSenderService } from './services/DbEventsSenderService';
import { ServerSynchronizerFactory } from './serverSynchronizer/ServiceSynchronizerFactory';

export default class SyncWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(SyncRepository).toSelf();
    this.container.bind(DB_MIGRATIONS).toConstantValue(initSyncTables);
  }

  async initialize() {
    this.container.resolve(DbEventsSenderService).initialize();

    // const { syncState$ } = await this.container
    //   .resolve(ServerSynchronizerFactory)
    //   .initialize();

    // syncState$.subscribe((state) => {
    //   console.log(
    //     `%c[${state.dbName}] New sync state: ${JSON.stringify(state)}`,
    //     'color:cyan;border:1px solid dodgerblue',
    //   );
    // });
  }
}
