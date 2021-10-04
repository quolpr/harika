import { BaseWorkerProvider } from '../../../lib/BaseWorkerProvider';
import { MIGRATIONS } from '../../../lib/db/types';
import { initNotesTable } from './migrations/createNotesTable';
import { NotesRepository } from './repositories/NotesRepository';

export default class NotesWorkerProvider extends BaseWorkerProvider {
  async register() {
    this.workerContainer.bind(NotesRepository).toSelf();
    this.workerContainer.bind(MIGRATIONS).toConstantValue(initNotesTable);

    this.registerRemote(NotesRepository);
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
