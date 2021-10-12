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

export const useNotesService = () => {
  return useCurrentVaultApp().getNotesService();
};

export const useVaultService = () => {
  return useCurrentVaultApp().getVaultService();
};

export const useBlocksScopesService = () => {
  return useCurrentVaultApp().getBlocksScopesService();
};

export const useNoteBlocksService = () => {
  return useCurrentVaultApp().getNoteBlocksService();
};

export const useNotesTreeRegistry = () => {
  return useCurrentVaultApp().getNotesTreeRegistry();
};

export const useFindService = () => {
  return useCurrentVaultApp().getFindService();
};

export const useDeleteService = () => {
  return useCurrentVaultApp().getDeleteService();
};

export const useImportExportService = () => {
  return useCurrentVaultApp().getImportExportService();
};

export const useRootStore = () => {
  return useCurrentVaultApp().getRootStore();
};