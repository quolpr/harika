import { expose } from 'comlink';
import DbWorkerExtension from '../../extensions/DbExtension/DbWorkerExtension';
import SyncWorkerExtension from '../../extensions/SyncExtension/SyncWorkerExtension';
import { RootWorker } from '../../framework/RootWorker';
import { UserWorkerExtension } from './UserExtension/UserWorkerExtension';

export class UserRootWorker extends RootWorker {
  async getExtensions() {
    return [DbWorkerExtension, SyncWorkerExtension, UserWorkerExtension];
  }
}

expose(UserRootWorker);
