import { NotesRepository } from './NotesRepository';
import { map } from 'rxjs/operators';
import { VaultModel } from './NotesRepository/models/VaultModel';
import { syncMiddleware } from './NotesRepository/models/syncable';
import * as remotedev from 'remotedev';
import { connectReduxDevTools } from 'mobx-keystone';
import { VaultDexieDatabase } from './NotesRepository/dexieDb/DexieDb';
import { ChangesHandler } from './NotesRepository/dexieDb/ChangesHandler';
import { toMobxSync } from './NotesRepository/dexieDb/toMobxSync';
import { UserDexieDatabase } from './UserDexieDb';
import { from } from 'rxjs';
import { v4 } from 'uuid';
import './dexieDbSyncProtocol';

export class VaultsRepository {
  // TODO: finde better naming(instead of conatiner)
  private vaultContainers: Record<string, VaultModel | undefined> = {};

  private dexieVaultDbs: Record<string, VaultDexieDatabase> = {};
  private noteRepo = new NotesRepository(this.dexieVaultDbs);

  database!: UserDexieDatabase;

  constructor(private dbId: string, private sync: boolean) {}

  getNoteRepository() {
    return this.noteRepo;
  }

  async init() {
    this.database = new UserDexieDatabase(this.dbId);

    await this.database.open();
    console.log('init vaults');

    if (this.sync) {
      this.database.syncable.connect(
        'websocket',
        'wss://app-dev.harika.io/api/user',
        {
          scopeId: this.dbId,
        }
      );
    }
  }

  async getVault(vaultId: string) {
    if (this.vaultContainers[vaultId]) return this.vaultContainers[vaultId];

    this.vaultContainers[vaultId] = await this.initializeVaultAndRepo(vaultId);

    return this.vaultContainers[vaultId];
  }

  getAllVaultTuples$() {
    // TODO: add reactivity support
    return from(this.database.vaults.toArray()).pipe(
      map((vaults) =>
        vaults.map((v) => ({
          id: v.shortId,
          name: v.name,
          createAd: v.createdAt,
        }))
      )
    );
  }

  async createVault({ name, dbId }: { name: string; dbId: string }) {
    this.database.vaults.add({
      shortId: dbId,
      name,
      createdAt: new Date().getTime(),
      syncId: v4(),
    });

    return this.getVault(dbId);
  }

  private async initializeVaultAndRepo(id: string) {
    const vaultDoc = await this.database.vaults
      .where('shortId')
      .equals(id)
      .first();

    if (!vaultDoc) return;

    this.dexieVaultDbs[id] = new VaultDexieDatabase(id);

    await this.dexieVaultDbs[id].open();

    if (this.sync) {
      console.log('setuping sync');

      this.dexieVaultDbs[id].syncable.connect(
        'websocket',
        'wss://app-dev.harika.io/api/vault',
        { scopeId: vaultDoc.syncId }
      );
    }

    const vault = new VaultModel({ name: vaultDoc.name, $modelId: id });

    syncMiddleware(
      vault,
      new ChangesHandler(this.dexieVaultDbs[id], vault).handlePatch
    );

    toMobxSync(this.dexieVaultDbs[id], this.noteRepo, vault);

    // initRxDbToLocalSync(this.dexieVaultDbs[id], this.noteRepo, vault);

    const connection = remotedev.connectViaExtension({
      name: `Vault ${vault.name}`,
    });

    connectReduxDevTools(remotedev, connection, vault);

    return vault;
  }

  destroy = () => {
    // TODO: implement
  };
}
