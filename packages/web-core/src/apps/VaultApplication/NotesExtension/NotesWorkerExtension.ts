import { DB_MIGRATIONS } from '../../../extensions/DbExtension/types';
import { BaseExtension } from '../../../framework/BaseExtension';
import { toRemoteName } from '../../../framework/utils';
import { initNotesTable } from './migrations/createNotesTable';
import { NotesRepository } from './repositories/NotesRepository';

export default class NotesWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(NotesRepository).toSelf();
    this.container.bind(DB_MIGRATIONS).toConstantValue(initNotesTable);

    this.container
      .bind(toRemoteName(NotesRepository))
      .toDynamicValue(() => this.container.get(NotesRepository));
  }

  async onReady() {
    // this.workerContainer.get(NotesRepository).create(
    //   {
    //     id: '123',
    //     title: 'hey!',
    //     dailyNoteDate: null,
    //     createdAt: 123,
    //     updatedAt: 123,
    //     rootBlockId: '132',
    //   },
    //   {
    //     shouldRecordChange: true,
    //     source: 'inDbChanges',
    //   },
    // );
  }
}
