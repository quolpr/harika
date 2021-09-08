import { useContext } from 'react';
import { CurrentVaultContext } from '../contexts/CurrentVaultContext';

export const useCurrentVault = () => {
  return useContext(CurrentVaultContext);
};

export const useBlocksApp = () => {
  return useCurrentVault().noteBlocksApp;
};
