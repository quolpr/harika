import { IDatabaseChange } from '../types';
import { Knex } from 'knex';

export class IncomingChangesHandler {
  constructor(private db: Knex) {}

  async handleIncomeChanges(
    schemaName: string,
    receivedFromClientId: string,
    changes: IDatabaseChange[]
  ) {
    await this.db.transaction(async (trx) => {
      await this.db.schema
        .withSchema(schemaName)
        .transacting(trx)
        .raw(`LOCK TABLE "${schemaName}"."changes" IN EXCLUSIVE MODE`);

      console.log(changes);
      console.log(
        await this.db
          .insert(
            changes.map((ch) => ({ ...ch, receivedFromClientId })),
            ['id', 'rev']
          )
          .transacting(trx)
          .withSchema(schemaName)
          .into('changes')
      );
    });

    // 1. Lock changes/entity tables for write
    // 2. Save incoming changes
    // 3. ChangesSelectorForSnapshot
    // 4. EntitySnapshotBuilder
    // returns table+id of affected entities
  }
}
