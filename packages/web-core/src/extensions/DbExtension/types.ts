import { IQueryExecuter } from './DB';

export type IMigration = {
  up: (db: IQueryExecuter) => Promise<void>;
  down?: () => void;
  id: number;
  name: string;
};

export const DB_NAME = 'dbName' as const;
export const DB_MIGRATIONS = 'migrations' as const;
