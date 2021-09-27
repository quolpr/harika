import { DB } from './DB';

export type IMigration = {
  up: (db: DB<any>) => void;
  down?: () => void;
  id: number;
  name: string;
};
