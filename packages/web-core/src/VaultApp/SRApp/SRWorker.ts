import { IMigration } from '../../db/core/types';
import { BaseDbSyncWorker } from '../../db/sync/persistence/BaseDbSyncWorker';
import { createCardsTable } from './migrations/createCardsTable';

export class SRWorker extends BaseDbSyncWorker {
  getApplyChangesService() {}

  migrations(): IMigration[] {
    return [createCardsTable];
  }
}
