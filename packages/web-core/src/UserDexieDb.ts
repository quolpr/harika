import Dexie from 'dexie';

export interface VaultDocType {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
}

export class UserDexieDatabase extends Dexie {
  vaults: Dexie.Table<VaultDocType, string>;

  constructor(public id: string) {
    super(`harika_user_${id}`);

    this.version(1).stores({
      vaults: 'id, name, createdAt, updatedAt',
    });

    this.version(2).stores({
      _syncStatus: 'id',
      _changesToSend: '++rev',
      _changesFromServer: 'id',
    });

    this.vaults = this.table('vaults');
  }
}
