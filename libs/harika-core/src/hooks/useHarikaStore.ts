import { useContext } from 'react';
import { HarikaNotesContext } from '../contexts/HarikaStoreContext';

export const useHarikaStore = () => {
  return useContext(HarikaNotesContext);
};
