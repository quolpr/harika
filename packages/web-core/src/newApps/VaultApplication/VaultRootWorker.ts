import { expose } from 'comlink';
import { RootWorker } from '../../framework/RootWorker';

export class VaultRootWorker extends RootWorker {
  async getExtensions() {
    return (
      await Promise.all([
        import('../../extensions/DbExtension/DbExtension'),
        import('../../extensions/SyncExtension/SyncExtension'),
        import('./NotesExtension/NotesWorkerProvider'),
      ])
    ).map((res) => res.default);
  }
}

expose(VaultRootWorker);
