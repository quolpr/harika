import { FocusedBlock, VaultApplication } from '@harika/web-core';
import { createContext, useContext } from 'react';

export const CurrentVaultAppContext = createContext<VaultApplication>(
  {} as VaultApplication,
);

export const useCurrentVaultApp = () => {
  return useContext(CurrentVaultAppContext);
};

export const useNotesService = () => {
  return useCurrentVaultApp().getNotesService();
};

export const useVaultService = () => {
  return useCurrentVaultApp().getVaultService();
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

export const useFocusedBlock = () => {
  return new FocusedBlock({ state: undefined });
};

export const useRootStore = () => {
  return useCurrentVaultApp().getRootStore();
};
