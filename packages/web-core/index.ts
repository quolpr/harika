import 'reflect-metadata';
import '@harika-org/sql.js/dist/sql-wasm.wasm?url';

export type {
  Token,
  NoteRefToken,
  TagToken,
} from './src/lib/blockParser/types';
export { ScopedBlock } from './src/apps/VaultApplication/BlocksScopeExtension/models/ScopedBlock';
export { BlocksScope } from './src/apps/VaultApplication/BlocksExtension/models/BlocksScope';
export * from './src/lib/blockParser/parseStringToTree';
export * from './src/lib/generateId';
export * from './src/apps/VaultApplication/NotesTreeExtension/models/NotesTreeRegistry';
export * from './src/apps/VaultApplication/NotesTreeExtension/models/NotesTreeNote';
export * from './src/apps/VaultApplication/NoteBlocksExtension/models/NoteBlockModel';
export * from './src/lib/toObserver';
export { BlockModelsRegistry } from './src/apps/VaultApplication/NoteBlocksExtension/models/BlockModelsRegistry';
export { VaultApplication } from './src/apps/VaultApplication/VaultApplication';
export { UserApplication } from './src/apps/UserApplication/UserApplication';
export { UserVaultsService } from './src/apps/UserApplication/UserExtension/services/UserVaultsService';
export { VaultService } from './src/apps/VaultApplication/VaultExtension/services/VaultService';
export { NoteModel } from './src/apps/VaultApplication/NotesExtension/models/NoteModel';
export { NotesService } from './src/apps/VaultApplication/BlocksExtension/services/NotesService';
export { NoteBlocksService } from './src/apps/VaultApplication/NoteBlocksExtension/services/NoteBlocksService';
