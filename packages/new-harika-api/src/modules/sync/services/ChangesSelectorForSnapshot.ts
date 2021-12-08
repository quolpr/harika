import { IDocChangeWithRev } from '../types';
import { IChangesService } from './changesService';
import { groupBy, minBy } from 'lodash';

export class ChangesSelectorForSnapshot {
  constructor(private changesService: IChangesService) {}

  getChangesForChanges(incomingChanges: IDocChangeWithRev[]) {
    const groupedChanges = groupBy(incomingChanges, (ch) => ch.collectionName);

    Object.entries(groupBy(incomingChanges, (ch) => ch.collectionName)).map(
      ([table, chs]) => [table, minBy(chs, (ch) => ch.timestamp)]
    );

    for (const change in incomingChanges) {
      // check if there any changes that happened after clock of change
      // If any changes that not present in incomingChanges - return all changes of entity
      // If no changes or all changes present in incomingChanges - return create change of the snapshot
    }
  }

  // If there any other changes happened from minTime
  // then we should rebuild the snapshot
  private async getChangesForChangesForTable(
    table: string,
    entityId: string,
    incomingChanges: IDocChangeWithRev[]
  ) {
    // Set due to O(1)
    const incomingChangeIds = new Set(incomingChanges.map((ch) => ch.id));

    const minTimeChange = minBy(incomingChanges, (ch) => ch.timestamp);

    const allChangesAfterMinTime =
      await this.changesService.getChangesAfterOrEqualClock(
        table,
        minTimeChange.timestamp
      );

    if (allChangesAfterMinTime.some((ch) => !incomingChangeIds.has(ch.id))) {
    }
  }
}
