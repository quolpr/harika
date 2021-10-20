import { DB_MIGRATIONS } from '../../../extensions/DbExtension/types';
import { BaseExtension } from '../../../framework/BaseExtension';
import { toRemoteName } from '../../../framework/utils';
import { NotesBlocksRepository } from './worker/repositories/NotesBlocksRepository';
import { initNoteBlocksTables } from './worker/migrations/initNoteBlocksTables';
import { addBlockIdsToNoteBlocksTables } from './worker/migrations/addBlockIdsToNoteBlocksTable';
import { addBlocksTreeDescriptorsTable } from './worker/migrations/addBlockTreeDescriptorTable';
import { BlocksTreeDescriptorsRepository } from './worker/repositories/BlockTreeDescriptorsRepository';
import { REPOS_WITH_SYNC } from '../../../extensions/SyncExtension/types';

export default class NoteBlocksWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(NotesBlocksRepository).toSelf();
    this.container.bind(BlocksTreeDescriptorsRepository).toSelf();

    this.container
      .bind(toRemoteName(NotesBlocksRepository))
      .toDynamicValue(() => this.container.get(NotesBlocksRepository));
    this.container
      .bind(toRemoteName(BlocksTreeDescriptorsRepository))
      .toDynamicValue(() =>
        this.container.get(BlocksTreeDescriptorsRepository),
      );

    this.container.bind(DB_MIGRATIONS).toConstantValue(initNoteBlocksTables);
    this.container
      .bind(DB_MIGRATIONS)
      .toConstantValue(addBlockIdsToNoteBlocksTables);
    this.container
      .bind(DB_MIGRATIONS)
      .toConstantValue(addBlocksTreeDescriptorsTable);

    this.container
      .bind(REPOS_WITH_SYNC)
      .toDynamicValue(() => this.container.get(NotesBlocksRepository));
    this.container
      .bind(REPOS_WITH_SYNC)
      .toDynamicValue(() =>
        this.container.get(BlocksTreeDescriptorsRepository),
      );
  }

  async onReady() {}
}
