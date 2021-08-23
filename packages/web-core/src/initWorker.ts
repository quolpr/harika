import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { Remote, wrap } from 'comlink';
import type { VaultWorker } from './SqlNotesRepository.worker';
import { generateId } from './generateId';

async function init() {
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

  const Klass = wrap<VaultWorker>(worker) as unknown as new () => Promise<
    Remote<VaultWorker>
  >;
  const obj = await new Klass();

  await obj.initialize('123');

  const notesRepo = await obj.notesRepo();

  console.log(
    await notesRepo.create({
      id: generateId(),
      title: 'hey',
      dailyNoteDate: undefined,
      createdAt: new Date().getTime(),
    }),
  );

  console.log(await notesRepo.getAll());
  console.log({
    changesToSend: await (await obj.syncRepo()).getChangesToSend(),
  });
}

init();
