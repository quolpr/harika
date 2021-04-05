import { createContext } from 'react';
import { VaultModel } from '@harika/harika-core';

export const CurrentVaultContext = createContext<VaultModel>({} as VaultModel);
