import { IAdapterBuilder, NoteRepository, Vault } from './NoteRepository';
import { VaultRow } from './VaultRepository/vaultDb/VaultRow';
import {
  vaultsSchema,
  VaultsTableNames,
} from './VaultRepository/vaultDb/schema';
import { Collection, Database, Q } from '@nozbe/watermelondb';
import { map } from 'rxjs/operators';
import { VaultModel } from './NoteRepository/models/Vault';
import { Queries } from './NoteRepository/db/Queries';
import { ChangesHandler } from './NoteRepository/ChangesHandler';
import { NoteBlockRow } from './NoteRepository/db/rows/NoteBlockRow';
import { NoteLinkRow } from './NoteRepository/db/rows/NoteLinkRow';
import { NoteRow } from './NoteRepository/db/rows/NoteRow';
import { syncMiddleware } from './NoteRepository/models/syncable';
import { Syncher } from './NoteRepository/sync';
import { notesSchema } from './NoteRepository/db/notesSchema';
import { VaultsSyncer } from './VaultRepository/vaultDb/VaultsSyncer';
import { Socket } from 'phoenix';
import { v4 as uuidv4 } from 'uuid';
import * as remotedev from 'remotedev';
import { connectReduxDevTools } from 'mobx-keystone';
import { RxdbChangesHandler } from './NoteRepository/rxdb/ChangesHandler';
import { HarikaRxDatabase, initDb } from './NoteRepository/rxdb/initDb';
import { initRxDbToLocalSync } from './NoteRepository/rxdb/sync';

export class VaultRepository {
  // TODO: finde better naming(instead of conatiner)
  private vaultContainers: Record<string, Vault | undefined> = {};
  private database: Database;
  private vaultsCollection: Collection<VaultRow>;

  private rxVaultsDbs: Record<string, HarikaRxDatabase> = {};
  private noteRepo = new NoteRepository(this.rxVaultsDbs);

  syncer?: VaultsSyncer;
  private socket?: Socket;

  constructor(
    private buildAdapter: IAdapterBuilder,
    userId: string,
    authToken: string,
    private isOffline: boolean
  ) {
    this.database = new Database({
      // TODO: add user id to dbName
      adapter: this.buildAdapter({
        dbName: `vaults-${userId}`,
        schema: vaultsSchema,
      }),
      modelClasses: [VaultRow],
      actionsEnabled: true,
    });

    this.vaultsCollection = this.database.collections.get<VaultRow>(
      VaultsTableNames.VAULTS
    );

    if (!this.isOffline) {
      this.socket = new Socket('ws://localhost:5000/socket', {
        params: { token: authToken },
      });
      this.socket.connect();

      this.syncer = new VaultsSyncer(this.database, this.socket, userId);
      this.syncer.sync();
    }

    console.log('vault reposting initialized!');
  }

  // TODO: refactor to get noteRepo()
  getNoteRepository() {
    return this.noteRepo;
  }

  async getVault(vaultId: string) {
    if (this.vaultContainers[vaultId]) return this.vaultContainers[vaultId];

    this.vaultContainers[vaultId] = await this.initializeVaultAndRepo(vaultId);

    return this.vaultContainers[vaultId];
  }

  getAllVaultTuples$() {
    return this.vaultsCollection
      .query()
      .observe()
      .pipe(
        map((vaults) =>
          vaults.map((v) => ({
            id: v.id,
            name: v.name,
            createAd: v.createdAt,
          }))
        )
      );
  }

  async createVault({ name }: { name: string }) {
    return this.database.action<Vault>(async () => {
      const { id } = await this.vaultsCollection.create((rec) => {
        rec._raw.id = uuidv4();
        rec.name = name;
      });
      return this.getVault(id);
    });
  }

  private async initializeVaultAndRepo(id: string) {
    const [vaultRow] = await this.vaultsCollection
      .query(Q.where('id', Q.eq(id)))
      .fetch();

    if (!vaultRow) return;

    // this.vaultDbs[id] = new Database({
    //   adapter: this.buildAdapter({
    //     dbName: `vault-${id}`,
    //     schema: notesSchema,
    //   }),
    //   modelClasses: [NoteRow, NoteBlockRow, NoteLinkRow],
    //   actionsEnabled: true,
    // });

    this.rxVaultsDbs[id] = await initDb(id);

    const vault = new VaultModel({ name: vaultRow.name, $modelId: id });
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
