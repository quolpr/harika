import { DB } from './DB';

export type IMigration = {
  up: (db: DB<any>) => void;
  down?: () => void;
  id: number;
  name: string;
};

export const DB_NAME = 'dbName' as const;
export const MIGRATIONS = 'migrations' as const;
