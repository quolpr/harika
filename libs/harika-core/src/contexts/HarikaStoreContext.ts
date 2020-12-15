import { createContext } from 'react';
import { HarikaNotes } from '@harika/harika-notes';

export const HarikaNotesContext = createContext<HarikaNotes>({} as HarikaNotes);
