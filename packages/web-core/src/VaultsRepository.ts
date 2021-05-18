import { NotesRepository } from './NotesRepository';
import { VaultModel } from './NotesRepository/models/VaultModel';
import { syncMiddleware } from './NotesRepository/models/syncable';
// import * as remotedev from 'remotedev';
import { connectReduxDevTools } from 'mobx-keystone';
import { VaultDexieDatabase } from './NotesRepository/dexieDb/DexieDb';
import { ChangesHandler } from './NotesRepository/dexieDb/ChangesHandler';
import { toMobxSync } from './NotesRepository/dexieDb/toMobxSync';
import { UserDexieDatabase } from './UserDexieDb';
import './dexieHelpers/dexieDbSyncProtocol';
import { liveSwitch } from './dexieHelpers/onDexieChange';

export class VaultsRepository {
  // TODO: finde better naming(instead of conatiner)
  private vaultContainers: Record<string, VaultModel | undefined> = {};

  private dexieVaultDbs: Record<string, VaultDexieDatabase> = {};
  private noteRepo = new NotesRepository(this.dexieVaultDbs);

  database!: UserDexieDatabase;

  constructor(
    private dbId: string,
    private sync: boolean,
    private config: { wsUrl: string },
  ) {
    // TODO: should be called in destroy
    // and destroy should be called by react app
    window.onunload = () => {
      console.log('db are closed');

      if (this.database) this.database.close();

      Object.values(this.dexieVaultDbs).forEach((db) => db.close());

      return null;
    };
  }

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
        `${this.config.wsUrl}/api/user`,
        {
          scopeId: this.dbId,
          gatewayName: 'user',
        },
      );
    }
  }

  async getVault(vaultId: string) {
    if (this.vaultContainers[vaultId]) return this.vaultContainers[vaultId];

    this.vaultContainers[vaultId] = await this.initializeVaultAndRepo(vaultId);

    return this.vaultContainers[vaultId];
  }

  getAllVaultTuples$() {
    return this.database.vaultsChange$.pipe(
      liveSwitch(async () =>
        (await this.database.vaults.toArray()).map((v) => ({
          id: v.id,
          name: v.name,
          createAd: v.createdAt,
        })),
      ),
    );
  }

  async createVault({ name, dbId }: { name: string; dbId: string }) {
    this.database.vaults.add({
      id: dbId,
      name,
      createdAt: new Date().getTime(),
    });

    return this.getVault(dbId);
  }

  private async initializeVaultAndRepo(id: string) {
    const vaultDoc = await this.database.vaults.where('id').equals(id).first();

    if (!vaultDoc) return;

    this.dexieVaultDbs[id] = new VaultDexieDatabase(id);

    await this.dexieVaultDbs[id].open();

    if (this.sync) {
      this.dexieVaultDbs[id].syncable.connect(
        'websocket',
        `${this.config.wsUrl}/api/vault`,
        { scopeId: vaultDoc.id, gatewayName: 'vault' },
      );
    }

    const vault = new VaultModel({ name: vaultDoc.name, $modelId: id });

    syncMiddleware(
      vault,
      new ChangesHandler(this.dexieVaultDbs[id], vault).handlePatch,
    );

    toMobxSync(this.dexieVaultDbs[id], this.noteRepo, vault);

    // // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
    //   const connection = remotedev.connectViaExtension({
    //     name: `Vault ${vault.name}`,
    //   });

    //   connectReduxDevTools(remotedev, connection, vault);
    // }

    return vault;
  }

  destroy = () => {
    // TODO: implement
  };
}
