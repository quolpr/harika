import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { Remote, wrap } from 'comlink';
import type { BaseDbWorker } from './SqlNotesRepository.worker';

export const getDbWorker = async <T extends BaseDbWorker>(
  dbName: string,
  windowId: string,
  type: 'vault' | 'user',
): Promise<{ worker: Remote<T>; terminate: () => void }> => {
  let worker =
    type === 'vault'
      ? new Worker(new URL('./VaultDb.worker.js', import.meta.url), {
          name: 'sql-vault-worker',
          type: import.meta.env.MODE === 'development' ? 'module' : 'classic',
        })
      : new Worker(new URL('./UserDb.worker.js', import.meta.url), {
          name: 'sql-user-worker',
          type: import.meta.env.MODE === 'development' ? 'module' : 'classic',
        });

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
