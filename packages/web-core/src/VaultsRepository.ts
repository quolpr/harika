import { VaultModel } from './NotesRepository/models/VaultModel';
import { syncMiddleware } from './NotesRepository/models/syncable';
import { VaultDexieDatabase } from './NotesRepository/dexieDb/DexieDb';
import { ToDexieSyncer } from './NotesRepository/dexieDb/ToDexieSyncer';
import { toMobxSync } from './NotesRepository/dexieDb/toMobxSync';
import { UserDexieDatabase, VaultDocType } from './UserDexieDb';
import { NotesRepository } from './NotesRepository';
import { initSync } from './dexie-sync/init';
import { liveQuery } from 'dexie';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class VaultsRepository {
  private notesRepositories: Record<string, NotesRepository | undefined> = {};

  database!: UserDexieDatabase;

  constructor(
    private dbId: string,
    private sync: boolean,
    private config: { wsUrl: string },
  ) {}

  async init() {
    this.database = new UserDexieDatabase(this.dbId);

    console.debug(`Init vaults for dbId ${this.dbId}`);

    console.log(this.dbId);
    if (this.sync) {
      initSync(this.database, this.dbId, `${this.config.wsUrl}/api/user`);
    }
  }

  async getVault(vaultId: string) {
    return (await this.getNotesRepo(vaultId))?.vault;
  }

  async getNotesRepo(vaultId: string) {
    if (this.notesRepositories[vaultId]) return this.notesRepositories[vaultId];

    this.notesRepositories[vaultId] = await this.initializeNotesRepo(vaultId);

    return this.notesRepositories[vaultId];
  }

  // TODO: also clean on server
  async dropVault(vaultId: string) {
    const db = new VaultDexieDatabase(vaultId);

    await this.database.vaults.delete(vaultId);

    await db.delete();
  }

  getAllVaultTuples$() {
    return from(
      liveQuery(() => this.database.vaults.toArray()) as Observable<
        VaultDocType[]
      >,
    ).pipe(
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
    this.database.vaults.add({
      id: dbId,
      name,
      createdAt: new Date().getTime(),
    });

    return this.getVault(dbId);
  }

  async renameVault(dbId: string, name: string) {
    const res = await this.database.vaults.update(dbId, { name });

    return res === 1 ? true : false;
  }

  private async initializeNotesRepo(id: string) {
    const vaultDoc = await this.database.vaults.where('id').equals(id).first();

    if (!vaultDoc) return;

    const db = new VaultDexieDatabase(id);

    const vault = new VaultModel({
      name: vaultDoc.name,
      $modelId: id,
    });

    syncMiddleware(vault, new ToDexieSyncer(db, vault).handlePatch);
    toMobxSync(db, vault);

    const repo = new NotesRepository(db, vault);

    if (this.sync) {
      initSync(db, db.id, `${this.config.wsUrl}/api/vault`);
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
