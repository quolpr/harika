import Dexie from 'dexie';
import { onDexieChange } from './onDexieChange';
import { Observable } from 'rxjs';

interface VaultDocType {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
}

export class UserDexieDatabase extends Dexie {
  vaults: Dexie.Table<VaultDocType, string>;
  vaultsChange$: Observable<void>;

  constructor(id: string) {
    super(`harika_user_${id}`);

    this.version(1).stores({
      vaults: '$$id, name, createdAt, updatedAt',
    });

    this.vaults = this.table('vaults');

    this.vaultsChange$ = onDexieChange(this, 'vaults');
  }
}
