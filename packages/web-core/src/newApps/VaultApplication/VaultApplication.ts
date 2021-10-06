import { BaseApplication } from '../../framework/BaseApplication';
import { NotesExtension } from './NotesExtension/NotesExtension';
// @ts-ignore
import VaultWorker from './VaultRootWorker?worker';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import {NoteBlocksExtension} from "./NoteBlocksExtension/NoteBlocksExtension";

export class VaultApplication extends BaseApplication {
  get applicationName() {
    return 'vault';
  }

  get workerClass() {
    return VaultWorker;
  }

  get extensions() {
    return [DbAppExtension, SyncAppExtension, NotesExtension, NoteBlocksExtension];
  }
}
