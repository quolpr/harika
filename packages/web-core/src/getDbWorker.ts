import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { Remote, wrap } from 'comlink';
import type { BaseDbWorker } from './SqlNotesRepository.worker';

export const getDbWorker = async <T extends BaseDbWorker>(
  dbName: string,
  windowId: string,
  type: 'vault' | 'user',
): Promise<{ worker: Remote<T>; terminate: () => void }> => {
  let worker = new Worker(
    new URL(
      type === 'vault' ? './VaultDb.worker.js' : './UserDb.worker.js',
      import.meta.url,
    ),
    {
      name: 'sql-notes-worker',
      type: 'module',
    },
  );

  // This is only required because Safari doesn't support nested
  // workers. This installs a handler that will proxy creating web
  // workers through the main thread
  initBackend(worker);

  const Klass = wrap<BaseDbWorker>(worker) as unknown as new (
    dbName: string,
    windowId: string,
  ) => Promise<Remote<T>>;
  const obj = await new Klass(dbName, windowId);

  await obj.initialize();

  return {
    worker: obj,
    terminate: () => {
      worker.terminate();
    },
  };
};
