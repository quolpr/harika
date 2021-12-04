import { IDatabaseChange } from '../types';
import { Knex } from 'knex';

export class IncomingChangesHandler {
  constructor(private db: Knex) {}

  handleIncomeChanges(schemaName: string, changes: IDatabaseChange[]) {
    // 1. Lock changes/entity tables for write
    // 2. Save incoming changes
    // 3. ChangesSelectorForSnapshot
    // 4. EntitySnapshotBuilder
    // returns table+id of affected entities
  }
}
