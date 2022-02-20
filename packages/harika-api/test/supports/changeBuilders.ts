import {
  DocChangeType,
  HybridClock,
  IAnyDoc,
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
  makeClientId,
  WithClientId,
  WithRev,
} from '@harika/sync-common';
import { Factory } from 'fishery';
import { v4 } from 'uuid';

import { db } from '../../src/db/db';

const clientId = makeClientId();
const clock = new HybridClock(0, 0, clientId);

const defaultObjectId = '123';
const defaultTableName = 'testTable';

let currentRev = 0;

const onCreateHook =
  <T>(schemaName: string | undefined) =>
  async (ch: T) => {
    if (!schemaName) throw new Error('Schema name should be present!');

    const [{ rev }] = await db
      .insert(ch, ['rev'])
      .withSchema(schemaName)
      .into('changes');

    return { ...ch, rev };
  };

export const createChangeFactory = Factory.define<
  WithClientId<WithRev<ICreateChange<string, IAnyDoc>>>,
  { schemaName: string }
>(({ params, onCreate, transientParams }) => {
  const finalId = params.docId || params?.doc?.id || defaultObjectId;

  onCreate(onCreateHook(transientParams.schemaName));

  return {
    id: params.id || v4(),
    type: DocChangeType.Create,
    collectionName: params.collectionName || defaultTableName,
    docId: finalId,
    doc: params.doc
      ? ({ ...params.doc, id: finalId } as IAnyDoc)
      : { id: finalId, content: 'test' },
    receivedFromClientId: params?.receivedFromClientId || clientId,
    timestamp: params.timestamp || HybridClock.send(clock).toString(),
    rev: currentRev++,
  };
});

export const updateChangeFactory = Factory.define<
  WithClientId<WithRev<IUpdateChange<string, IAnyDoc>>>,
  { schemaName: string }
>(({ params, onCreate, transientParams }) => {
  onCreate(onCreateHook(transientParams.schemaName));

  return {
    id: params.id || v4(),
    type: DocChangeType.Update,
    collectionName: params.collectionName || defaultTableName,
    docId: params.docId || defaultObjectId,
    from: params.from || { content: 'test' },
    to: params.to || { content: 'changed test' },
    timestamp: params.timestamp || HybridClock.send(clock).toString(),
    receivedFromClientId: params?.receivedFromClientId || clientId,
    rev: currentRev++,
  };
});

export const deleteChangeFactory = Factory.define<
  WithClientId<WithRev<IDeleteChange<string>>>,
  { schemaName: string }
>(({ params, onCreate, transientParams }) => {
  onCreate(onCreateHook(transientParams.schemaName));

  return {
    id: params.id || v4(),
    type: DocChangeType.Delete,
    collectionName: params.collectionName || defaultTableName,
    docId: params.docId || defaultObjectId,
    timestamp: params.timestamp || HybridClock.send(clock).toString(),
    receivedFromClientId: params?.receivedFromClientId || clientId,
    rev: currentRev++,
  };
});
