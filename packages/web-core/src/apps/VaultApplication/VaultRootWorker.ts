import { expose } from 'comlink';
import DbWorkerExtension from '../../extensions/DbExtension/DbWorkerExtension';
import SyncWorkerExtension from '../../extensions/SyncExtension/SyncWorkerExtension';
import { RootWorker } from '../../framework/RootWorker';
import BlocksScopeWorkerExtension from './BlocksScopeExtension/BlocksScopeWorkerExtension';
import NoteBlocksWorkerExtension from './NoteBlocksExtension/NoteBlocksWorkerExtension';
import NotesWorkerExtension from './NotesExtension/NotesWorkerExtension';
import VaultWorkerExtension from './VaultExtension/VaultWorkerExtension';

export class VaultRootWorker extends RootWorker {
  async getExtensions() {
    return [
      DbWorkerExtension,
      SyncWorkerExtension,
      BlocksScopeWorkerExtension,
      NotesWorkerExtension,
      NoteBlocksWorkerExtension,
      VaultWorkerExtension,
    ];
  }
}

expose(VaultRootWorker);
