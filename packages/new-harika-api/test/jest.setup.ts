import '../src/loadConfig';
import { db } from '../src/db/db';

const toExport = async () => {
  await db.migrate.latest();
};

export default toExport;
