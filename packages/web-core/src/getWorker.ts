import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { Remote, wrap } from 'comlink';
import type { VaultWorker } from './SqlNotesRepository.worker';

export const getWorker = async (dbName: string) => {
  let worker = new Worker(
    new URL('./SqlNotesRepository.worker.js', import.meta.url),
    {
      name: 'sql-notes-worker',
      type: 'module',
    },
  );

  // This is only required because Safari doesn't support nested
  // workers. This installs a handler that will proxy creating web
  // workers through the main thread
  initBackend(worker);

  const Klass = wrap<VaultWorker>(worker) as unknown as new (
    dbName: string,
  ) => Promise<Remote<VaultWorker>>;
  const obj = await new Klass(dbName);

  await obj.initialize();

  return obj;
};
