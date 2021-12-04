import { HybridClock } from '../../src/modules/sync/HybridClock';
import {
  IAnyEntity,
  ICreateChange,
  DatabaseChangeType,
  IUpdateChange,
  IDeleteChange,
} from '../../src/modules/sync/types';
import { v4 } from 'uuid';
import { Factory } from 'fishery';
import { pg } from '../../src/plugins/db';

const clock = HybridClock.parse(HybridClock.since(new Date().toISOString()));

const defaultObjectId = '123';
const defaultTableName = 'testTable';

const onCreateHook =
  <T>(schemaName: string | undefined) =>
  async (ch: T) => {
    if (!schemaName) throw new Error('Schema name should be present!');

    const [{ rev }] = await pg
      .insert(
        { ...ch, receivedFromClientId: '22a5f0d7-8df5-4e10-b53f-b46f24ff43d4' },
        ['rev']
      )
      .withSchema(schemaName)
      .into('changes');

    return { ...ch, rev };
  };

export const createChangeFactory = Factory.define<
  ICreateChange<string, IAnyEntity>,
  { schemaName: string }
>(({ params, onCreate, transientParams }) => {
  const finalId = params.key || params.obj.id || defaultObjectId;

  onCreate(onCreateHook(transientParams.schemaName));

  return {
    id: params.id || v4(),
    type: DatabaseChangeType.Create,
    table: params.table || defaultTableName,
    key: finalId,
    obj: params.obj
      ? ({ ...params.obj, id: finalId } as IAnyEntity)
      : { id: finalId, content: 'test' },
    timestamp: params.timestamp || HybridClock.send(clock).toString(),
  };
});

export const updateChangeFactory = Factory.define<
  IUpdateChange<string, IAnyEntity>,
  { schemaName: string }
>(({ params, onCreate, transientParams }) => {
  onCreate(onCreateHook(transientParams.schemaName));

  return {
    id: params.id || v4(),
    type: DatabaseChangeType.Update,
    table: params.table || defaultTableName,
    key: params.key || defaultObjectId,
    from: params.from || { content: 'test' },
    to: params.to || { content: 'changed test' },
    timestamp: params.timestamp || HybridClock.send(clock).toString(),
  };
});

export const deleteChangeFactory = Factory.define<
  IDeleteChange<string>,
  { schemaName: string }
>(({ params, onCreate, transientParams }) => {
  onCreate(onCreateHook(transientParams.schemaName));

  return {
    id: params.id || v4(),
    type: DatabaseChangeType.Delete,
    table: params.table || defaultTableName,
    key: params.key || defaultObjectId,
    timestamp: params.timestamp || HybridClock.send(clock).toString(),
  };
});
