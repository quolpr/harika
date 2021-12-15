import {
  HybridClock,
  IAnyDoc,
  ICreateChange,
  DocChangeType,
  IUpdateChange,
  IDeleteChange,
  WithRev,
  makeClientId,
} from '@harika/sync-common';
import { v4 } from 'uuid';
import { Factory } from 'fishery';
import { pg } from '../../src/plugins/db';

const clientId = makeClientId();
const clock = new HybridClock(0, 0, clientId);

const defaultObjectId = '123';
const defaultTableName = 'testTable';

let currentRev = 0;

const onCreateHook =
  <T>(schemaName: string | undefined) =>
  async (ch: T) => {
    if (!schemaName) throw new Error('Schema name should be present!');

    const [{ rev }] = await pg
      .insert({ ...ch, receivedFromClientId: clientId }, ['rev'])
      .withSchema(schemaName)
      .into('changes');

    return { ...ch, rev };
  };

export const createChangeFactory = Factory.define<
  WithRev<ICreateChange<string, IAnyDoc>>,
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
    timestamp: params.timestamp || HybridClock.send(clock).toString(),
    rev: currentRev++,
  };
});

export const updateChangeFactory = Factory.define<
  WithRev<IUpdateChange<string, IAnyDoc>>,
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
    rev: currentRev++,
  };
});

export const deleteChangeFactory = Factory.define<
  WithRev<IDeleteChange<string>>,
  { schemaName: string }
>(({ params, onCreate, transientParams }) => {
  onCreate(onCreateHook(transientParams.schemaName));

  return {
    id: params.id || v4(),
    type: DocChangeType.Delete,
    collectionName: params.collectionName || defaultTableName,
    docId: params.docId || defaultObjectId,
    timestamp: params.timestamp || HybridClock.send(clock).toString(),
    rev: currentRev++,
  };
});
