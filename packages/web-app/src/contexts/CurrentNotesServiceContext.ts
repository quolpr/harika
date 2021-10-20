import { VaultService } from '@harika/web-core';
import { NoteBlocksService } from '@harika/web-core';
import { NotesService } from '@harika/web-core';
import { createContext } from 'react';

export const VaultServiceContext = createContext<VaultService>(
  {} as VaultService,
);

export const NotesServiceContext = createContext<NotesService>(
  {} as NotesService,
);

export const NoteBlocksServiceContext = createContext<NoteBlocksService>(
  {} as NoteBlocksService,
);
