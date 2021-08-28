import { VaultModel } from '../VaultContext/domain/VaultModel';
import { syncMiddleware } from '../VaultContext/domain/syncable';
import { VaultDexieDatabase } from '../VaultContext/persistence/DexieDb';
import { NotesService } from '../VaultContext/NotesService';
import { initSync } from '../dexie-sync/init';
import { map } from 'rxjs/operators';
import { generateId } from '../generateId';
import { ToDbSyncer } from '../VaultContext/syncers/ToDbSyncer';
import { ToDomainSyncer } from '../VaultContext/syncers/ToDomainSyncer';
import { getDbWorker } from '../getDbWorker';
import { DbEventsService } from '../DbEventsService';
import type { VaultDbWorker } from '../VaultDb.worker';
import { SqlVaultsRepository, vaultsTable } from '../SqlNotesRepository.worker';
import type { UserDbWorker } from '../UserDb.worker';
import type { Remote } from 'comlink';

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

    const { worker, terminate } = await getDbWorker<UserDbWorker>(
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
  async dropVault(vaultId: string) {
    const db = new VaultDexieDatabase(vaultId);

    await this.vaultsRepo.delete(vaultId, {
      shouldRecordChange: true,
      source: 'inDbChanges',
    });

    await db.delete();
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

    const vault = new VaultModel({
      name: vaultDoc.name,
      $modelId: id,
    });

    const dbName = `vault_${id}`;
    const { worker, terminate } = await getDbWorker<VaultDbWorker>(
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
