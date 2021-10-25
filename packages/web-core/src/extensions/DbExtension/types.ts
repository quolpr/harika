import { QueryExecResult } from '@harika-org/sql.js';
import { IQueryExecuter } from './DB';
import Q from 'sql-bricks';

export type IMigration = {
  up: (db: IQueryExecuter) => Promise<void>;
  down?: () => void;
  id: number;
  name: string;
};

export const DB_NAME = 'dbName' as const;
export const DB_MIGRATIONS = 'migrations' as const;

export type IStartTransactionCommand = {
  type: 'startTransaction';
  transactionId: string;
  commandId: string;
};
export type ICommitTransactionCommand = {
  type: 'commitTransaction';
  transactionId: string;
  commandId: string;
};
export type IRollbackTransactionCommand = {
  type: 'rollbackTransaction';
  transactionId: string;
  commandId: string;
};

export type IExecQueriesCommand = {
  type: 'execQueries';
  queries: Q.SqlBricksParam[];
  spawnTransaction?: boolean;
  transactionId?: string;
  commandId: string;
};

export type ICommand =
  | IStartTransactionCommand
  | IRollbackTransactionCommand
  | IExecQueriesCommand
  | ICommitTransactionCommand;

export type IResponse = {
  commandId: string;
  transactionId?: string;
} & (
  | {
      status: 'success';
      result: QueryExecResult[][];
    }
  | {
      status: 'error';
      message: string;
    }
);

export type IOutputWorkerMessage =
  | { type: 'initialized' }
  | { type: 'response'; data: IResponse };

export type IInputWorkerMessage =
  | { type: 'initialize'; dbName: string }
  | { type: 'command'; data: ICommand };

export const migrationsTable = 'migrations';
