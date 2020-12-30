import { createContext } from 'react';
import { Vault } from '@harika/harika-core';

export const CurrentVaultContext = createContext<Vault>({} as Vault);
