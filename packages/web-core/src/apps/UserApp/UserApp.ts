import { Vault } from '../VaultApp/Vault';
import { VaultApp } from '../VaultApp/VaultApp';
import { initSync } from '../../extensions/SyncExtension/serverSynchronizer/init';
import { map } from 'rxjs/operators';
import { generateId } from '../../lib/generateId';
import { ToDomainSyncer } from '../VaultApp/syncers/ToDomainSyncer';
import { getDbWorker } from '../../lib/getDbWorker';
import { DbEventsListenService } from '../../extensions/SyncExtension/services/DbEventsListenerService';
import {
  SqlVaultsRepository,
  vaultsTable,
} from './repositories/VaultsRepository';
import type { Remote } from 'comlink';
import type { VaultAppDbWorker } from '../VaultApp/VaultAppDb.worker';
import type { UserDbWorker } from './UserDb.worker';
import { BehaviorSubject } from 'rxjs';
import { registerRootStore } from 'mobx-keystone';

const windowId = generateId();

export class UserApp {
  private notesServices: Record<string, VaultApp | undefined> = {};
  private vaultsRepo!: Remote<SqlVaultsRepository>;
  private dbEventsService!: DbEventsListenService;

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

    this.dbEventsService = new DbEventsListenService(dbName);

    if (this.sync) {
      // Don't need to await
      initSync(
        dbName,
        worker,
        this.config.wsUrl,
        this.config.authToken,
        this.dbEventsService,
        new BehaviorSubject(true),
      );
    }
  }

  async getVault(vaultId: string) {
    return (await this.getNotesService(vaultId))?.vault;
  }

  async getNotesService(vaultId: string) {
    if (this.notesServices[vaultId]) return this.notesServices[vaultId];

    this.notesServices[vaultId] = await this.initializeVaultApp(vaultId);

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

  private async initializeVaultApp(id: string) {
    const vaultDoc = await this.vaultsRepo.getById(id);

    if (!vaultDoc) return;

    const vault = new Vault({
      name: vaultDoc.name,
      $modelId: id,
    });

    registerRootStore(vault);

    const dbName = `vault_${id}`;

    const { worker } = await getDbWorker<VaultAppDbWorker>(
      dbName,
      windowId,
      'vault',
    );

    const notesRepo = await worker.getNotesRepo();
    const blocksRepo = await worker.getNotesBlocksRepo();
    const viewsRepo = await worker.getBlocksViewsRepo();

    const eventsService = new DbEventsListenService(dbName);

    new ToDomainSyncer(
      eventsService.changesChannel$(),
      vault,
      windowId,
    ).start();

    const service = new VaultApp(
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
      service.initSync(
        dbName,
        worker,
        this.config.wsUrl,
        this.config.authToken,
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
