import { vaultModelType } from './consts';
import type { VaultModel } from './Vault';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isVault = (model: any): model is VaultModel =>
  '$modelType' in model && model.$modelType === vaultModelType;
