import { useContext } from 'react';
import { HarikaNotesContext } from '../contexts/HarikaStoreContext';

export const useHarikaCurrentVault = () => {
  return useContext(HarikaNotesContext);
};
