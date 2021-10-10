import { VaultApplication } from '@harika/web-core';
import { createContext } from 'react';

export const CurrentVaultAppContext = createContext<VaultApplication>(
  {} as VaultApplication,
);
