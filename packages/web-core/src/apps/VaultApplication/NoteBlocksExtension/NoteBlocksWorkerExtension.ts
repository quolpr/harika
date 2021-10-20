import { NotesBlocksRepository } from './worker/repositories/NotesBlocksRepository';
import { initNoteBlocksTables } from './worker/migrations/initNoteBlocksTables';
import { addBlockIdsToNoteBlocksTables } from './worker/migrations/addBlockIdsToNoteBlocksTable';
import { addBlocksTreeDescriptorsTable } from './worker/migrations/addBlockTreeDescriptorTable';
import { BlocksTreeDescriptorsRepository } from './worker/repositories/BlockTreeDescriptorsRepository';
import { BaseSyncWorkerExtension } from '../../../extensions/SyncExtension/BaseSyncWorkerExtension';

export default class NoteBlocksWorkerExtension extends BaseSyncWorkerExtension {
  repos() {
    return [
      { repo: NotesBlocksRepository, withSync: true, remote: true },
      { repo: BlocksTreeDescriptorsRepository, withSync: true, remote: true },
    ];
  }

  migrations() {
    return [
      initNoteBlocksTables,
      addBlockIdsToNoteBlocksTables,
      addBlocksTreeDescriptorsTable,
    ];
  }
}
