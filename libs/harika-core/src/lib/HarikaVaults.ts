import { initializeVault, IAdapterBuilder, Vault } from './Vault';
import { VaultRow } from './HarikaVaults/db/VaultRow';
import { schema, VaultsTableNames } from './HarikaVaults/db/schema';
import { Database, Q } from '@nozbe/watermelondb';
import { map } from 'rxjs/operators';

export function initializeVaults(buildAdapter: IAdapterBuilder) {
  const database = new Database({
    // TODO: add user id
    adapter: buildAdapter({ dbName: `vaults`, schema: schema }),
    modelClasses: [VaultRow],
    actionsEnabled: true,
  });

  const vaultsCollection = database.collections.get<VaultRow>(
    VaultsTableNames.VAULTS
  );

  // TODO: maybe rename to manager?
  class HarikaVaults {
    private vaults: Record<string, Vault> = {};

    getVault = async (id: string) => {
      if (this.vaults[id]) return this.vaults[id];

      const [vaultRow] = await vaultsCollection
        .query(Q.where('id', Q.eq(id)))
        .fetch();

      if (!vaultRow) return;

      this.vaults[id] = initializeVault(id, vaultRow.name, buildAdapter);

      return this.vaults[id];
    };

    getAllVaultTuples$() {
      return vaultsCollection
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
      return database.action(async () => {
        const { id } = await vaultsCollection.create((rec) => {
          rec.name = name;
        });
        return this.getVault(id);
      });
    }
  }
  const vaults = new HarikaVaults();

  // const connection = remotedev.connectViaExtension({
  //   name: 'Harika vault',
  // });
  //
  // connectReduxDevTools(remotedev, connection, vaults);
  //
  // registerRootStore(vaults);

  return vaults;
}

export type HarikaVaults = ReturnType<typeof initializeVaults>;
