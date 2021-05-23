import { VaultModel } from './NotesRepository/models/VaultModel';
import { syncMiddleware } from './NotesRepository/models/syncable';
import { VaultDexieDatabase } from './NotesRepository/dexieDb/DexieDb';
import { ChangesHandler } from './NotesRepository/dexieDb/ChangesHandler';
import { toMobxSync } from './NotesRepository/dexieDb/toMobxSync';
import { UserDexieDatabase } from './UserDexieDb';
import { liveSwitch } from './dexieHelpers/onDexieChange';
import { NotesRepository } from './NotesRepository';
import { RxSyncer } from './dexieHelpers/RxSyncer';

export class VaultsRepository {
  private notesRepositories: Record<string, NotesRepository | undefined> = {};

  database!: UserDexieDatabase;
  syncer?: RxSyncer;

  constructor(
    private dbId: string,
    private sync: boolean,
    private config: { wsUrl: string },
  ) {}

  async init() {
    this.database = new UserDexieDatabase(this.dbId);

    console.log('init vaults');

    if (this.sync) {
      this.syncer = new RxSyncer(
        this.database,
        'user',
        this.dbId,
        `${this.config.wsUrl}/api/user`,
      );
    }
  }

  async getVault(vaultId: string) {
    return (await this.getNotesRepo(vaultId))?.vault;
  }

  async getNotesRepo(vaultId: string) {
    console.log({ repo: this.notesRepositories[vaultId] });

    if (this.notesRepositories[vaultId]) return this.notesRepositories[vaultId];

    this.notesRepositories[vaultId] = await this.initializeNotesRepo(vaultId);

    return this.notesRepositories[vaultId];
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

  private async initializeNotesRepo(id: string) {
    const vaultDoc = await this.database.vaults.where('id').equals(id).first();

    if (!vaultDoc) return;

    const db = new VaultDexieDatabase(id);

    const vault = new VaultModel({ name: vaultDoc.name, $modelId: id });

    syncMiddleware(vault, new ChangesHandler(db, vault).handlePatch);
    toMobxSync(db, vault);

    const repo = new NotesRepository(db, vault);

    if (this.sync) {
      repo.initSync(this.config.wsUrl);
    }

    return repo;
  }

  close = () => {
    this.database.close();
  };

  closeNotesRepo = (id: string) => {
    const repo = this.notesRepositories[id];

    if (!repo) return;

    repo.close();

    this.notesRepositories[id] = undefined;
  };
}
