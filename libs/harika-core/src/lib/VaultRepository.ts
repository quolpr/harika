import {
  IAdapterBuilder,
  NoteRepository,
  Vault,
} from './NoteRepository';
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

export class VaultRepository {
  // TODO: finde better naming(instead of conatiner)
  private vaultContainers: Record<string, Vault | undefined> = {};
  private database: Database;
  private vaultsCollection: Collection<VaultRow>;

  private vaultDbs: Record<string, Database> = {};
  private noteRepo = new NoteRepository(this.vaultDbs);

  constructor(
    private buildAdapter: IAdapterBuilder,
    userId: string,
    authToken: string
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
    return this.database.action(async () => {
      const { id } = await this.vaultsCollection.create((rec) => {
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

    this.vaultDbs[id] = new Database({
      adapter: this.buildAdapter({
        dbName: `vault-${id}`,
        schema: notesSchema,
      }),
      modelClasses: [NoteRow, NoteBlockRow, NoteLinkRow],
      actionsEnabled: true,
    });

    const vault = new VaultModel({ name: vaultRow.name, $modelId: id });
    const queries = new Queries(this.vaultDbs[id]);
    const syncer = new Syncher(
      this.vaultDbs[id],
      vault,
      queries,
      this.getNoteRepository()
    );

    syncMiddleware(
      vault,
      new ChangesHandler(this.vaultDbs[id], queries, vault, syncer).handlePatch
    );

    return vault;
  }
}
