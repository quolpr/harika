import { useContext } from 'react';
import { CurrentVaultContext } from '../contexts/CurrentVaultContext';

export const useCurrentVault = () => {
  return useContext(CurrentVaultContext);
};
