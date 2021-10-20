import 'reflect-metadata';

export type {
  Token,
  NoteRefToken,
  TagToken,
} from './src/lib/blockParser/types';
export { ScopedBlock } from './src/apps/VaultApplication/BlocksScopeExtension/app/models/ScopedBlock';
export { BlocksScope } from './src/apps/VaultApplication/BlocksScopeExtension/app/models/BlocksScope';
export * from './src/lib/blockParser/parseStringToTree';
export * from './src/lib/generateId';
export * from './src/apps/VaultApplication/NotesTreeExtension/models/NotesTreeRegistry';
export * from './src/apps/VaultApplication/NotesTreeExtension/models/NotesTreeNote';
export * from './src/apps/VaultApplication/NoteBlocksExtension/app/models/NoteBlockModel';
export * from './src/lib/toObserver';
export { BlockModelsRegistry } from './src/apps/VaultApplication/NoteBlocksExtension/app/models/BlockModelsRegistry';
export { VaultApplication } from './src/apps/VaultApplication/VaultApplication';
export { UserApplication } from './src/apps/UserApplication/UserApplication';
export { UserVaultsService } from './src/apps/UserApplication/UserExtension/app/services/UserVaultsService';
export { VaultService } from './src/apps/VaultApplication/VaultExtension/app/services/VaultService';
export { NoteModel } from './src/apps/VaultApplication/NotesExtension/app/models/NoteModel';
