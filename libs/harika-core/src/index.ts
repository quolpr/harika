export { useCurrentNote } from './hooks/useCurrentNote';
export { useFocusedBlock } from './hooks/useFocusedBlock';
export { useHarikaCurrentVault as useHarikaStore } from './hooks/useHarikaStore';
export {
  ICurrentFocusedBlockState,
  CurrentFocusedBlockContext,
} from './contexts/CurrentEditContent';
export { HarikaNotesContext as HarikaStoreContext } from './contexts/HarikaStoreContext';
export {
  ICurrentNoteState,
  CurrentNoteContext,
} from './contexts/CurrentNoteIdContext';

export * from './harika-vaults';
