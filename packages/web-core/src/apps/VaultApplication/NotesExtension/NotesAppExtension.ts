import { injectable } from 'inversify';
import { SyncConfig } from '../../../extensions/SyncExtension/app/serverSynchronizer/SyncConfig';
import { BaseAppExtension } from '../../../framework/BaseAppExtension';
import { notesMapper } from './app/mappers/notesMapper';
import { NoteModel } from './app/models/NoteModel';
import { NotesStore } from './app/models/NotesStore';
import { NotesService } from './app/services/NotesService';
import { NotesRepository } from './worker/repositories/NotesRepository';

@injectable()
export class NotesAppExtension extends BaseAppExtension {
  async register() {
    const store = new NotesStore({});

    this.container.bind(NotesStore).toConstantValue(store);
    this.container.bind(NotesService).toSelf();

    await this.bindRemote(NotesRepository);
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
}
