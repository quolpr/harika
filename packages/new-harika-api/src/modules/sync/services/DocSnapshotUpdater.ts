import { Knex } from 'knex';
import { minBy } from 'lodash';
import { IDocChangeWithRev } from '../types';
import { snapshotToCreateChange } from '../utils';
import { IChangesService } from './changesService';
import { DocSnapshotsService } from './DocSnapshotsService';

export class DocSnapshotUpdater {
  constructor(
    private changesService: IChangesService,
    private docsService: DocSnapshotsService
  ) {}

  async handle(
    trx: Knex,
    collectionName: string,
    docId: string,
    changes: IDocChangeWithRev[]
  ) {
    const minTimeChange = minBy(changes, (ch) => ch.timestamp);

    const isAnyChangesAlreadyHappened =
      await this.changesService.isAnyChangeAfterClock(
        trx,
        collectionName,
        docId,
        minTimeChange.timestamp,
        changes.map((ch) => ch.id)
      );

    const changesForSnapshot = await this.getChangesForSnapshot(
      isAnyChangesAlreadyHappened,
      trx,
      collectionName,
      docId,
      changes
    );
  }

  private async getChangesForSnapshot(
    isAnyChangesAlreadyHappened: boolean,

    trx: Knex,
    collectionName: string,
    docId: string,
    changes: IDocChangeWithRev[]
  ) {
    if (isAnyChangesAlreadyHappened) {
      // We need to recalculate snapshot from the start
      return await this.changesService.getAllChanges(
        trx,
        collectionName,
        docId
      );
    } else {
      return [
        snapshotToCreateChange(
          await this.docsService.getSnapshot(trx, collectionName, docId)
        ),
        ...changes,
      ];
    }
  }
}
