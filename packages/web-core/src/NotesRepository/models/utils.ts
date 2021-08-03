import { vaultModelType } from './consts';
import { NotesTreeModel, notesTreeModelType } from './NotesTree/NotesTreeModel';
import type { VaultModel } from './VaultModel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isVault = (model: any): model is VaultModel =>
  '$modelType' in model && model.$modelType === vaultModelType;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNotesTree = (model: any): model is NotesTreeModel =>
  '$modelType' in model && model.$modelType === notesTreeModelType;
