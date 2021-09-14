import { Vault } from '../VaultContext/domain/Vault';
import { syncMiddleware } from '../VaultContext/domain/syncable';
import { NotesService } from '../VaultContext/NotesService';
import { initSync } from '../db-sync/synchronizer/init';
import { map } from 'rxjs/operators';
import { generateId } from '../generateId';
import { ToDbSyncer } from '../VaultContext/syncers/ToDbSyncer';
import { ToDomainSyncer } from '../VaultContext/syncers/ToDomainSyncer';
import { getDbWorker } from '../getDbWorker';
import { DbEventsService } from '../db-sync/DbEventsService';
import {
  SqlVaultsRepository,
  vaultsTable,
} from './persistence/VaultsRepository';
import type { Remote } from 'comlink';
import type { VaultDbWorker } from '../VaultContext/persistence/VaultDb.worker';
import type { UserDbWorker } from './persistence/UserDb.worker';

const windowId = generateId();

export class VaultsService {
  private notesServices: Record<string, NotesService | undefined> = {};
  private vaultsRepo!: Remote<SqlVaultsRepository>;
  private dbEventsService!: DbEventsService;

  constructor(
    private dbId: string,
    private sync: boolean,
    private config: { wsUrl: string; authToken: string },
  ) {}

  async init() {
    const dbName = `harika_user_${this.dbId.replace(/-/g, '')}`;

    console.debug(`Init vaults for dbId ${this.dbId}`);

    const { worker } = await getDbWorker<UserDbWorker>(
      dbName,
      windowId,
      'user',
    );

    this.vaultsRepo = await worker.getVaultsRepo();

    this.dbEventsService = new DbEventsService(dbName);

    if (this.sync) {
      // Don't need to await
      initSync(
        dbName,
        worker,
        this.config.wsUrl,
        this.config.authToken,
        this.dbEventsService,
      );
    }
  }

  async getVault(vaultId: string) {
    return (await this.getNotesService(vaultId))?.vault;
  }

  async getNotesService(vaultId: string) {
    if (this.notesServices[vaultId]) return this.notesServices[vaultId];

    this.notesServices[vaultId] = await this.initializeNotesService(vaultId);

    return this.notesServices[vaultId];
  }

  // TODO: also clean on server
  // TODO: drop IDB
  async dropVault(vaultId: string) {
    await this.vaultsRepo.delete(vaultId, {
      shouldRecordChange: true,
      source: 'inDbChanges',
    });
  }

  getAllVaultTuples$() {
    return this.dbEventsService
      .liveQuery([vaultsTable], () => this.vaultsRepo.getAll())
      .pipe(
        map((vaults) =>
          vaults.map((v) => ({
            id: v.id,
            name: v.name,
            createAd: v.createdAt,
          })),
        ),
      );
  }

  async createVault({ name, dbId }: { name: string; dbId: string }) {
    await this.vaultsRepo.create(
      {
        id: dbId,
        name,
        updatedAt: new Date().getTime(),
        createdAt: new Date().getTime(),
      },
      {
        shouldRecordChange: true,
        source: 'inDbChanges',
      },
    );

    return await this.getVault(dbId);
  }

  async renameVault(dbId: string, name: string) {
    const vaultDoc = await this.vaultsRepo.getById(dbId);

    if (!vaultDoc) throw new Error('Nothing to rename');

    await this.vaultsRepo.update(
      {
        ...vaultDoc,
        name,
        updatedAt: new Date().getTime(),
      },
      {
        shouldRecordChange: true,
        source: 'inDbChanges',
      },
    );

    return true;
  }

  private async initializeNotesService(id: string) {
    const vaultDoc = await this.vaultsRepo.getById(id);

    if (!vaultDoc) return;

    const vault = new Vault({
      name: vaultDoc.name,
      $modelId: id,
    });

    const dbName = `vault_${id}`;

    const { worker } = await getDbWorker<VaultDbWorker>(
      dbName,
      windowId,
      'vault',
    );

    const notesRepo = await worker.getNotesRepo();
    const blocksRepo = await worker.getNotesBlocksRepo();
    const viewsRepo = await worker.getBlocksViewsRepo();

    syncMiddleware(
      vault,
      new ToDbSyncer(notesRepo, blocksRepo, viewsRepo, windowId, vault)
        .handlePatch,
    );
    const eventsService = new DbEventsService(dbName);

    new ToDomainSyncer(
      eventsService.changesChannel$(),
      vault,
      windowId,
    ).start();

    const service = new NotesService(
      notesRepo,
      blocksRepo,
      viewsRepo,
      eventsService,
      await worker.getImportExportService(),
      await worker.getDeleteNoteService(),
      await worker.getFindService(),
      vault,
    );

    // Don't need to await
    service.initialize();

    if (this.sync) {
      initSync(
        dbName,
        worker,
        this.config.wsUrl,
        this.config.authToken,
        eventsService,
      );
    }

    return service;
  }

  close = () => {
    // this.database.close();
  };

  closeNotesRepo = (id: string) => {
    const repo = this.notesServices[id];

    if (!repo) return;

    repo.close();

    this.notesServices[id] = undefined;
  };
}
