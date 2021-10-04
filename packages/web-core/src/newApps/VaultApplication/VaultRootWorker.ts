import { expose } from 'comlink';
import { RootWorker } from '../../lib/RootWorker';

export class VaultRootWorker extends RootWorker {
  async getProviders() {
    return (
      await Promise.all([
        import('./VaultWorkerProvider'),
        import('./NotesExtension/NotesWorkerProvider'),
      ])
    ).map((res) => new res.default(this.workerContainer));
  }
}

expose(VaultRootWorker);
