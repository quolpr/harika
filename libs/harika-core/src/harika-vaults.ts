import { createVault, IAdapterBuilder, Vault } from './harikaVaults/Vault';
export * from './harikaVaults/Vault';

export class HarikaVaults {
  constructor(private buildAdapter: IAdapterBuilder) {}

  private vaults: Record<string, Vault> = {};

  getVault = (id: string) => {
    if (this.vaults[id]) return this.vaults[id];

    this.vaults[id] = createVault(id, this.buildAdapter);

    return this.vaults[id];
  };
}
