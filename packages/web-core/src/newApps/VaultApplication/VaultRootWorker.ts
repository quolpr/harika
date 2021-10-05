import { expose } from 'comlink';
import { RootWorker } from '../../framework/RootWorker';

export class VaultRootWorker extends RootWorker {
  async getExtensions() {
    return (
      await Promise.all([
        import('./VaultWorkerProvider'),
        import('./NotesExtension/NotesWorkerProvider'),
      ])
    ).map((res) => res.default);
  }
}

expose(VaultRootWorker);
