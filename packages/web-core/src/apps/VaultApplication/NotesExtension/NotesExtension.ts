import { inject, injectable } from 'inversify';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import { notesMapper } from './mappers/notesMapper';
import { NoteModel } from './models/NoteModel';
import { NotesStore } from './models/NotesStore';
import { NotesRepository } from './repositories/NotesRepository';
import { NotesService } from './services/NotesService';

@injectable()
export class NotesExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    const store = new NotesStore({});

    this.container.bind(NotesStore).toConstantValue(store);
    this.container.bind(NotesService).toSelf();

    await this.remoteRegister.registerRemote(NotesRepository);
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
