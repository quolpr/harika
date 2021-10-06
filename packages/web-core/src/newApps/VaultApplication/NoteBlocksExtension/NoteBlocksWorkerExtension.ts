import { DB_MIGRATIONS } from '../../../extensions/DbExtension/types';
import { BaseExtension } from '../../../framework/BaseExtension';
import { toRemoteName } from '../../../framework/utils';
import {NotesBlocksRepository} from "./repositories/NotesBlocksRepository";
import {BlocksScopesRepository} from "./repositories/BlockScopesRepository";
import {initNoteBlocksTables} from "./migrations/initNoteBlocksTables";
import {addBlockIdsToNoteBlocksTables} from "./migrations/addBlockIdsToNoteBlocksTable";
import {SYNC_CHANGES_APPLIER} from "../../../extensions/SyncExtension/types";
import {BlocksScopesChangesApplier} from "./sync/BlocksScopesChangesApplier";
import {NoteblocksChangesApplier} from "./sync/NoteblocksChangesApplier";

export default class NoteBlocksWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(NotesBlocksRepository).toSelf();
    this.container.bind(BlocksScopesRepository).toSelf();

    this.container
      .bind(toRemoteName(NotesBlocksRepository))
      .toDynamicValue(() => this.container.get(NotesBlocksRepository));

    this.container
      .bind(toRemoteName(BlocksScopesRepository))
      .toDynamicValue(() => this.container.get(BlocksScopesRepository));

    this.container.bind(DB_MIGRATIONS).toConstantValue(initNoteBlocksTables);
    this.container.bind(DB_MIGRATIONS).toConstantValue(addBlockIdsToNoteBlocksTables);

  }

  async onReady() {

  }
}
