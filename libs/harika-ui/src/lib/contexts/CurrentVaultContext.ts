import { createContext } from 'react';
import { VaultModel } from '@harika/harika-front-core';

export const CurrentVaultContext = createContext<VaultModel>({} as VaultModel);
