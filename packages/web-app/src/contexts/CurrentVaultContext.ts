import { createContext } from 'react';
import type { VaultModel } from '@harika/web-core';

export const CurrentVaultContext = createContext<VaultModel>({} as VaultModel);
