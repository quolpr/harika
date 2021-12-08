import { DocChangeType, ICreateChange, IDocSnapshot } from './types';
import { v4 } from 'uuid';

export const snapshotToCreateChange = (
  snapshot: IDocSnapshot
): ICreateChange => {
  return {
    type: DocChangeType.Create,
    doc: snapshot.doc,
    id: v4(),
    docId: snapshot.docId,
    collectionName: snapshot.collectionName,
    scopeId: snapshot.scopeId,
    timestamp: snapshot.lastTimestamp,
  };
};
