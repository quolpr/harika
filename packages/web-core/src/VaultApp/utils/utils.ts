import { vaultModelType } from './consts';
import {
  NotesTreeRegistry,
  notesTreeRegistryModelType,
} from '../NotesTree/models/NotesTreeRegistry';
import type { Vault } from '../Vault';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isVault = (model: any): model is Vault =>
  '$modelType' in model && model.$modelType === vaultModelType;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNotesTree = (model: any): model is NotesTreeRegistry =>
  '$modelType' in model && model.$modelType === notesTreeRegistryModelType;
