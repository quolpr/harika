import { IMigration } from '../../../extensions/DbExtension/types';
import { BaseDbSyncWorker } from '../../../lib/db/sync/persistence/BaseDbSyncWorker';
import { createCardsTable } from './migrations/createCardsTable';

export class SRWorker extends BaseDbSyncWorker {
  getApplyChangesService() {}

  migrations(): IMigration[] {
    return [createCardsTable];
  }
}
