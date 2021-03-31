import { NoteRepository, Vault } from './NoteRepository';
import { map } from 'rxjs/operators';
import { VaultModel } from './NoteRepository/models/Vault';
import { syncMiddleware } from './NoteRepository/models/syncable';
import * as remotedev from 'remotedev';
import { connectReduxDevTools } from 'mobx-keystone';
import { RxdbChangesHandler } from './NoteRepository/rxdb/ChangesHandler';
import { VaultRxDatabase, initDb } from './NoteRepository/rxdb/initDb';
import { initDb as initStockDb } from './VaultRepository/rxdb/initDb';
import { initRxDbToLocalSync } from './NoteRepository/rxdb/sync';
import { StockRxDatabase } from './VaultRepository/rxdb/initDb';
import { generateId } from './generateId';

export class VaultRepository {
  // TODO: finde better naming(instead of conatiner)
  private vaultContainers: Record<string, Vault | undefined> = {};

  private rxVaultsDbs: Record<string, VaultRxDatabase> = {};
  private noteRepo = new NoteRepository(this.rxVaultsDbs);

  database!: StockRxDatabase;

  constructor(private stockId: string) {}

  getNoteRepository() {
    return this.noteRepo;
  }

  async init() {
    console.log('init!');
    this.database = await initStockDb(this.stockId);
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

  async createVault({ name }: { name: string }) {
    const id = generateId();

    this.database.vaults.insert({
      _id: id,
      name,
      createdAt: new Date().getTime(),
    });

    return this.getVault(id);
  }

  private async initializeVaultAndRepo(id: string) {
    const vaultDoc = await this.database.vaults
      .findOne({ selector: { _id: id } })
      .exec();

    if (!vaultDoc) return;

    // this.vaultDbs[id] = new Database({
    //   adapter: this.buildAdapter({
    //     dbName: `vault-${id}`,
    //     schema: notesSchema,
    //   }),
    //   modelClasses: [NoteRow, NoteBlockRow, NoteLinkRow],
    //   actionsEnabled: true,
    // });

    this.rxVaultsDbs[id] = await initDb(id);

    const vault = new VaultModel({ name: vaultDoc.name, $modelId: id });
    // const queries = new Queries(this.vaultDbs[id]);

    // const syncer =
    //   !this.isOffline && this.socket
    //     ? new Syncher(
    //         this.vaultDbs[id],
    //         this.socket,
    //         vault,
    //         queries,
    //         this.getNoteRepository()
    //       )
    //     : undefined;

    // syncMiddleware(
    //   vault,
    //   new ChangesHandler(this.vaultDbs[id], queries, vault, () =>
    //     syncer?.sync()
    //   ).handlePatch
    // );

    // const firstSync = this.rxVaultsDbs[id].noteblocks.sync({
    //   remote: `http://localhost:5984/harika_noteblocks_${id.replace(/-/g, '')}`, // remote database. This can be the serverURL, another RxCollection or a PouchDB-instance
    //   waitForLeadership: false, // (optional) [default=true] to save performance, the sync starts on leader-instance only
    //   options: {
    //     live: false,
    //   },
    // });

    // await firstSync.awaitInitialReplication();

    // this.rxVaultsDbs[id].noteblocks.sync({
    //   remote: `http://localhost:5984/harika_noteblocks_${id.replaceAll(
    //     '-',
    //     ''
    //   )}`, // remote database. This can be the serverURL, another RxCollection or a PouchDB-instance
    //   waitForLeadership: true, // (optional) [default=true] to save performance, the sync starts on leader-instance only
    //   options: {
    //     live: true,
    //     retry: true,
    //   },
    // });

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
