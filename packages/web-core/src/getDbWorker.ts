import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { wrap } from 'comlink';
import type { Remote } from 'comlink';
import type { BaseDbSyncWorker } from './db-sync/persistence/BaseDbSyncWorker';
// @ts-ignore
import UserDbWorker from './UserContext/persistence/UserDb.worker?worker';
// @ts-ignore
import VaultDbWorker from './VaultContext/persistence/VaultDb.worker?worker';
// Looks like vite bug. Just force wasm output
import '@harika-org/sql.js/dist/sql-wasm.wasm?url';

export const getDbWorker = async <T extends BaseDbSyncWorker>(
  dbName: string,
  windowId: string,
  type: 'vault' | 'user',
): Promise<{ worker: Remote<T>; terminate: () => void }> => {
  let worker = type === 'vault' ? new VaultDbWorker() : new UserDbWorker();

  // This is only required because Safari doesn't support nested
  // workers. This installs a handler that will proxy creating web
  // workers through the main thread
  initBackend(worker);

  const Klass = wrap<BaseDbSyncWorker>(worker) as unknown as new (
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
