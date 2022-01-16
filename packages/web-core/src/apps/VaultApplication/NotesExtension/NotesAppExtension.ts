import { injectable } from 'inversify';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { notesMapper } from './mappers/notesMapper';
import { NoteModel } from './models/NoteModel';
import { NotesStore } from './models/NotesStore';
import { NotesService } from '../BlocksExtension/services/NotesService';
import { initNotesTable } from './migrations/createNotesTable';
import { NotesRepository } from './repositories/NotesRepository';

@injectable()
export class NotesAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    const store = new NotesStore({});

    this.container.bind(NotesStore).toConstantValue(store);
    this.container.bind(NotesService).toSelf();
  }

  async initialize() {
    const notesStore = this.container.get(NotesStore);
    const syncConfig = this.container.get(SyncConfig);

    const disposeNotes = syncConfig.registerSyncRepo(
      notesMapper,
      NotesRepository,
    );

    const disposeSubscription = syncConfig.onModelChange(
      [NoteModel],
      ([notesAttrs], [deletedNoteIds]) => {
        notesStore.handleChanges(notesAttrs, deletedNoteIds);
      },
    );

    return () => {
      disposeNotes();
      disposeSubscription();
    };
  }

  async onReady() {}

  repos() {
    return [{ repo: NotesRepository, withSync: true, remote: true }];
  }

  migrations() {
    return [initNotesTable];
  }
}
