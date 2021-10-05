import { BaseApplication } from '../../framework/BaseApplication';
import { NotesExtension } from './NotesExtension/NotesExtension';
// @ts-ignore
import VaultWorker from './VaultRootWorker?worker';

export class VaultApplication extends BaseApplication {
  get applicationName() {
    return 'vault';
  }

  get workerClass() {
    return VaultWorker;
  }

  get extensions() {
    return [NotesExtension];
  }
}
