import { IDatabaseChange } from '../types';

export class ChangesSelectorForSnapshot {
  getChangesForChanges(incomingChanges: IDatabaseChange) {
    for (const change in incomingChanges) {
      // check if there any changes that happened after clock of change
      // If any changes that not present in incomingChanges - return all changes of entity
      // If no changes or all changes present in incomingChanges - return create change of the snapshot
    }
  }
}
