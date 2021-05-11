import { VaultUiState } from '@harika/harika-front-core';
import { createContext, useContext } from 'react';

export const CurrentVaultUiStateContext = createContext<VaultUiState>(
  (undefined as unknown) as VaultUiState
);

export const useCurrentVaultUiState = () => {
  return useContext(CurrentVaultUiStateContext);
};
