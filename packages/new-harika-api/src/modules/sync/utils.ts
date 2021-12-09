import { DocChangeType, ICreateChange, IDocSnapshot, WithRev } from './types';
import { v4 } from 'uuid';

export const snapshotToCreateChange = (
  snapshot: IDocSnapshot
): WithRev<ICreateChange> => {
  return {
    type: DocChangeType.Create,
    doc: snapshot.doc,
    id: v4(),
    docId: snapshot.docId,
    collectionName: snapshot.collectionName,
    scopeId: snapshot.scopeId,
    timestamp: snapshot.lastTimestamp,
    rev: snapshot.rev,
  };
};

type NonConstructorKeys<T> = {
  [P in keyof T]: T[P] extends new () => any ? never : P;
}[keyof T];
export type NonConstructor<T> = Pick<T, NonConstructorKeys<T>>;
