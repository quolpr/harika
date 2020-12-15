import { useContext } from 'react';
import { HarikaStoreContext } from '../contexts/HarikaStoreContext';

export const useHarikaStore = () => {
  return useContext(HarikaStoreContext);
};
