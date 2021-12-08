import { IDocChange, IDocChangeWithRev } from '../types';
import { Knex } from 'knex';

export class IncomingChangesHandler {
  constructor(private db: Knex) {}

  async handleIncomeChanges(
    schemaName: string,
    receivedFromClientId: string,
    changes: IDocChange[]
  ) {
    await this.db.transaction(async (trx) => {
      await this.db.schema
        .withSchema(schemaName)
        .transacting(trx)
        .raw(`LOCK TABLE "${schemaName}"."changes" IN EXCLUSIVE MODE`);

      const insertResult: { id: string; rev: number }[] = await this.db
        .insert(
          changes.map((ch) => ({ ...ch, receivedFromClientId })),
          ['id', 'rev']
        )
        .transacting(trx)
        .withSchema(schemaName)
        .into('changes');

      const idRevMap = Object.fromEntries(
        insertResult.map(({ id, rev }) => [id, rev])
      );

      const changesWithRev: IDocChangeWithRev[] = changes.map((ch) => ({
        ...ch,
        rev: idRevMap[ch.id],
      }));
    });

    // 1. Lock changes/entity tables for write
    // 2. Save incoming changes
    // 3. ChangesSelectorForSnapshot
    // 4. EntitySnapshotBuilder
    // returns table+id of affected entities
  }
}
