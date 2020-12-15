import { HarikaStore } from '@harika/harika-notes';
import { createContext } from 'react';

export const HarikaStoreContext = createContext<HarikaStore>({} as HarikaStore);
