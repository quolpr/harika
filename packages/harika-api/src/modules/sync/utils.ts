import {
  DocChangeType,
  ICreateChange,
  IDocChange,
  IDocSnapshot,
  WithRev,
} from '@harika/sync-common';
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

export const getSnapshotKey = (sn: IDocSnapshot) =>
  `${sn.collectionName}-${sn.docId}`;

export const getChangesKey = (ch: IDocChange) =>
  `${ch.collectionName}-${ch.docId}`;

export const getUniqKey = ({
  collectionName,
  docId,
}: {
  collectionName: string;
  docId: string;
}) => `${collectionName}-${docId}`;

export const parseKey = (key: string) => {
  const [collectionName, docId] = key.split('-');

  return { collectionName, docId };
};
