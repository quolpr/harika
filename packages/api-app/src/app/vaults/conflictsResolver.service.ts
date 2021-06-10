import { IDatabaseChange } from '@harika/common';

export class ConflictsResolverService {
  resolve(
    clientChanges: IDatabaseChange[],
    serverChangeSet: Record<string, IDatabaseChange>,
  ) {
    return { clientChanges, serverChangeSet };
  }
}
