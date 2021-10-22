import { injectable } from 'inversify';
import { SyncConfig } from '../../../extensions/SyncExtension/app/serverSynchronizer/SyncConfig';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { notesMapper } from './app/mappers/notesMapper';
import { NoteModel } from './app/models/NoteModel';
import { NotesStore } from './app/models/NotesStore';
import { NotesService } from './app/services/NotesService';
import { initNotesTable } from './worker/migrations/createNotesTable';
import { NotesRepository } from './worker/repositories/NotesRepository';

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
