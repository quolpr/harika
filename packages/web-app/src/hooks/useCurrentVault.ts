import { useContext } from 'react';
import { CurrentVaultAppContext } from '../contexts/CurrentVaultContext';

export const useCurrentVaultApp = () => {
  return useContext(CurrentVaultAppContext);
};
