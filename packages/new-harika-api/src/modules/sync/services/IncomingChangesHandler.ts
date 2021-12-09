import { IDocChange, IDocChangeWithRev } from '../types';
import { Knex } from 'knex';
import { IChangesService } from './changesService';
import { groupBy } from 'lodash';
import { IDocSnapshotRebuilder } from './DocSnapshotRebuilder';
import { IDocSnapshotsService } from './DocSnapshotsService';
import { NonConstructor } from '../utils';

export class IncomingChangesHandler {
  constructor(
    private db: Knex,
    private changesService: IChangesService,
    private snapshotRebuilder: IDocSnapshotRebuilder,
    private docSnapshotsService: IDocSnapshotsService
  ) {}

  async handleIncomeChanges(
    schemaName: string,
    receivedFromClientId: string,
    changes: IDocChange[]
  ) {
    return await this.db.transaction(async (trx) => {
      await trx.raw(`LOCK TABLE "${schemaName}"."changes" IN EXCLUSIVE MODE`);

      const newChanges: IDocChangeWithRev[] =
        await this.changesService.insertChanges(
          trx,
          schemaName,
          changes.map((ch) => ({ ...ch, receivedFromClientId }))
        );

      const snapshots = await Promise.all(
        Object.values(groupBy(newChanges, (ch) => ch.docId)).flatMap(
          async (chs) => {
            return await this.snapshotRebuilder.handle(
              trx,
              schemaName,
              chs[0].collectionName,
              chs[0].docId,
              chs
            );
          }
        )
      );

      await this.docSnapshotsService.insertSnapshots(
        trx,
        schemaName,
        snapshots
      );

      return snapshots;
    });
  }
}

export type IIncomingChangesHandler = NonConstructor<IncomingChangesHandler>;
