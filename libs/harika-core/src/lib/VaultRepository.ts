import { NoteRepository, Vault } from './NoteRepository';
import { map } from 'rxjs/operators';
import { VaultModel } from './NoteRepository/models/Vault';
import { syncMiddleware } from './NoteRepository/models/syncable';
import * as remotedev from 'remotedev';
import { connectReduxDevTools } from 'mobx-keystone';
import { RxdbChangesHandler } from './NoteRepository/rxdb/ChangesHandler';
import { VaultRxDatabase, initDb } from './NoteRepository/rxdb/initDb';
import { initHarikaDb } from './VaultRepository/rxdb/initDb';
import { initRxDbToLocalSync } from './NoteRepository/rxdb/sync';
import { HarikaRxDatabase } from './VaultRepository/rxdb/initDb';
import { generateId } from './generateId';

export class VaultRepository {
  // TODO: finde better naming(instead of conatiner)
  private vaultContainers: Record<string, Vault | undefined> = {};

  private rxVaultsDbs: Record<string, VaultRxDatabase> = {};
  private noteRepo = new NoteRepository(this.rxVaultsDbs);

  database!: HarikaRxDatabase;

  constructor(private dbId: string, private sync: false | { token: string }) {}

  getNoteRepository() {
    return this.noteRepo;
  }

  async init() {
    this.database = await initHarikaDb(this.dbId, this.sync);
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

    this.rxVaultsDbs[id] = await initDb(id, this.sync);

    const vault = new VaultModel({ name: vaultDoc.name, $modelId: id });

    syncMiddleware(
      vault,
      new RxdbChangesHandler(this.rxVaultsDbs[id], vault).handlePatch
    );

    initRxDbToLocalSync(this.rxVaultsDbs[id], this.noteRepo, vault);

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
