import { createContext } from 'react';
import type { Vault } from '@harika/web-core';

export const CurrentVaultContext = createContext<Vault>({} as Vault);
