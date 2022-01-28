import { VaultApplication } from '@harika/web-core';
import { createContext, useContext } from 'react';

export const CurrentVaultAppContext = createContext<VaultApplication>(
  {} as VaultApplication,
);

export const useCurrentVaultApp = () => {
  return useContext(CurrentVaultAppContext);
};

export const useCurrentVaultId = () => {
  return useContext(CurrentVaultAppContext).applicationId;
};

export const useNoteBlocksService = () => {
  return useCurrentVaultApp().getNoteBlocksService();
};

export const useBlocksScopesService = () => {
  return useCurrentVaultApp().getBlocksScopesService();
};

export const useTextBlocksService = () => {
  return useCurrentVaultApp().getTextBlocksService();
};

export const useNotesTreeRegistry = () => {
  return useCurrentVaultApp().getNotesTreeRegistry();
};

export const useFindService = () => {
  return useCurrentVaultApp().getFindService();
};

export const useBlocksStore = () => {
  return useCurrentVaultApp().getRootStore().blocksStore;
};

export const useUpdateTitleService = () => {
  return useCurrentVaultApp().getUpdateNoteTitleService();
};

export const useUpdateLinkService = () => {
  return useCurrentVaultApp().getUpdateLinksService();
};

export const useImportExportService = () => {
  return useCurrentVaultApp().getImportExportService();
};

export const useAllBlocksService = () => {
  return useCurrentVaultApp().getAllBlocksService();
};

export const useDeleteBlocksService = () => {
  return useCurrentVaultApp().getDeleteNoteService();
};

export const useRootStore = () => {
  return useCurrentVaultApp().getRootStore();
};

export const useSyncState$ = () => {
  return useCurrentVaultApp().getSyncState$();
};

export const useIsConnectionAllowed$ = () => {
  return useCurrentVaultApp().getIsConnectionAllowed$();
};
