import { HybridClock } from '../../src/modules/sync/HybridClock';
import {
  IAnyEntity,
  ICreateChange,
  DatabaseChangeType,
  IUpdateChange,
  IDeleteChange,
} from '../../src/modules/sync/types';
import { v4 } from 'uuid';

const clock = HybridClock.parse(HybridClock.since(new Date().toISOString()));

export const buildCreateChange = <
  TableName extends string = string,
  T extends IAnyEntity = IAnyEntity
>(
  table: TableName,
  obj: T
): ICreateChange<TableName, T> => {
  return {
    id: v4(),
    type: DatabaseChangeType.Create,
    table: table,
    key: obj.id,
    obj,
    timestamp: HybridClock.send(clock).toString(),
  };
};

export const buildUpdateChange = <
  TableName extends string = string,
  T extends IAnyEntity = IAnyEntity
>(
  table: TableName,
  key: string,
  from: Partial<T>,
  to: Partial<T>
): IUpdateChange<TableName, T> => {
  return {
    id: v4(),
    type: DatabaseChangeType.Update,
    table: table,
    key,
    from,
    to,
    timestamp: HybridClock.send(clock).toString(),
  };
};

export const buildDeleteChange = <TableName extends string = string>(
  table: TableName,
  key: string
): IDeleteChange<TableName> => {
  return {
    id: v4(),
    type: DatabaseChangeType.Delete,
    table: table,
    key,
    timestamp: HybridClock.send(clock).toString(),
  };
};
