import { NotesRepository } from './NotesRepository';
import { map } from 'rxjs/operators';
import { VaultModel } from './NotesRepository/models/VaultModel';
import { syncMiddleware } from './NotesRepository/models/syncable';
import * as remotedev from 'remotedev';
import { connectReduxDevTools } from 'mobx-keystone';
import { initDb, initVaultSync } from './NotesRepository/rxdb/initDb';
import { initHarikaDb, initHarikaSync } from './VaultsRepository/rxdb/initDb';
import { initRxDbToLocalSync } from './NotesRepository/rxdb/sync';
import { HarikaRxDatabase } from './VaultsRepository/rxdb/initDb';
import { VaultDexieDatabase } from './NotesRepository/dexieDb/DexieDb';
import { ChangesHandler } from './NotesRepository/dexieDb/ChangesHandler';
import { toMobxSync } from './NotesRepository/dexieDb/toMobxSync';

export class VaultsRepository {
  // TODO: finde better naming(instead of conatiner)
  private vaultContainers: Record<string, VaultModel | undefined> = {};

  private dexieVaultDbs: Record<string, VaultDexieDatabase> = {};
  private noteRepo = new NotesRepository(this.dexieVaultDbs);

  database!: HarikaRxDatabase;

  constructor(private dbId: string, private sync: false | { token: string }) {}

  getNoteRepository() {
    return this.noteRepo;
  }

  async init() {
    this.database = await initHarikaDb(this.dbId);

    this.database.waitForLeadership().then(() => {
      if (this.sync) {
        // Don't await to not block UI
        initHarikaSync(this.database, this.dbId, this.sync.token);

        console.log('HarikaDb isLeader now');
        document.title = '♛ ' + document.title;
      }
    });
  }

  async getVault(vaultId: string) {
    if (this.vaultContainers[vaultId]) return this.vaultContainers[vaultId];

    this.vaultContainers[vaultId] = await this.initializeVaultAndRepo(vaultId);

    return this.vaultContainers[vaultId];
  }

  getAllVaultTuples$() {
    return this.database.vaults.find().$.pipe(
      map((vaults) =>
        vaults.map((v) => ({
          id: v._id,
          name: v.name,
          createAd: v.createdAt,
        }))
      )
    );
  }

  async createVault({ name, dbId }: { name: string; dbId: string }) {
    this.database.vaults.insert({
      _id: dbId,
      name,
      createdAt: new Date().getTime(),
    });

    return this.getVault(dbId);
  }

  private async initializeVaultAndRepo(id: string) {
    const vaultDoc = await this.database.vaults
      .findOne({ selector: { _id: id } })
      .exec();

    if (!vaultDoc) return;

    this.dexieVaultDbs[id] = new VaultDexieDatabase(id);

    await this.dexieVaultDbs[id].open();

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
