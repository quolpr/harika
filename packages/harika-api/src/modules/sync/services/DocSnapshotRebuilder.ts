import { Knex } from 'knex';
import { minBy } from 'lodash';
import { IDocChangeWithRev, IDocSnapshot } from '@harika/sync-common';
import { NonConstructor, snapshotToCreateChange } from '../utils';
import { buildSnapshot } from './buildSnapshot';
import { IChangesService } from './changesService';
import { DocSnapshotsService } from './DocSnapshotsService';

export class DocSnapshotRebuilder {
  constructor(
    private changesService: IChangesService,
    private docSnapshotsService: DocSnapshotsService
  ) {}

  async handle(
    trx: Knex,
    schemaName: string,
    collectionName: string,
    docId: string,
    changes: IDocChangeWithRev[]
  ): Promise<IDocSnapshot> {
    const minTimeChange = minBy(changes, (ch) => ch.timestamp);

    const changesForSnapshot = await this.getChangesForSnapshot(
      trx,
      minTimeChange,
      schemaName,
      collectionName,
      docId,
      changes
    );

    return buildSnapshot(changesForSnapshot);
  }

  private async getChangesForSnapshot(
    trx: Knex,
    minTimeChange: IDocChangeWithRev,
    schemaName: string,
    collectionName: string,
    docId: string,
    changes: IDocChangeWithRev[]
  ) {
    // We are getting also snapshot cause in most cases we we will be applying changes on snapshot
    const [isAnyChangesAlreadyHappened, snapshot] = await Promise.all([
      this.changesService.isAnyChangeAfterClock(
        trx,
        schemaName,
        collectionName,
        docId,
        minTimeChange.timestamp,
        changes.map((ch) => ch.id)
      ),
      this.docSnapshotsService.getSnapshot(
        trx,
        schemaName,
        collectionName,
        docId
      ),
    ]);

    if (isAnyChangesAlreadyHappened || !snapshot) {
      console.log(`${schemaName}-${collectionName}-${docId} full recalculate`);

      // We need to recalculate snapshot from the start, cause we can't make
      // calculation from snapshot cause snapshot time newer
      return await this.changesService.getAllChanges(
        trx,
        schemaName,
        collectionName,
        docId
      );
    } else {
      console.log(
        `${schemaName}-${collectionName}-${docId} partial recalculate`
      );

      return [snapshotToCreateChange(snapshot), ...changes];
    }
  }
}

export type IDocSnapshotRebuilder = NonConstructor<DocSnapshotRebuilder>;
