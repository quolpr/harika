import { BaseSyncWorkerExtension } from '../../../extensions/SyncExtension/BaseSyncWorkerExtension';
import { initNotesTable } from './worker/migrations/createNotesTable';
import { NotesRepository } from './worker/repositories/NotesRepository';

export default class NotesWorkerExtension extends BaseSyncWorkerExtension {
  repos() {
    return [{ repo: NotesRepository, withSync: true, remote: true }];
  }

  migrations() {
    return [initNotesTable];
  }
}
