import { expose } from 'comlink';
import { RootWorker } from '../../framework/RootWorker';

export class VaultRootWorker extends RootWorker {
  async getExtensions() {
    return (
      await Promise.all([
        import('../../extensions/DbExtension/DbWorkerExtension'),
        import('../../extensions/SyncExtension/SyncWorkerExtension'),
        import('./NotesExtension/NotesWorkerExtension'),
        import('./NoteBlocksExtension/NoteBlocksWorkerExtension'),
        import('./VaultExtension/VaultWorkerExtension'),
      ])
    ).map((res) => res.default);
  }
}

expose(VaultRootWorker);
