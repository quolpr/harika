export * from './src/apps/VaultApp/VaultApp';
export * from './src/apps/UserApp/UserApp';
export type {
  Token,
  NoteRefToken,
  TagToken,
} from './src/lib/blockParser/types';
export { ScopedBlock } from './src/apps/VaultApp/NoteBlocksApp/views/ScopedBlock';
export { BlocksScope } from './src/apps/VaultApp/NoteBlocksApp/views/BlocksScope';
export * from './src/lib/blockParser/parseStringToTree';
export * from './src/lib/generateId';
export * from './src/apps/VaultApp/NotesTreeApp/models/NotesTreeRegistry';
export * from './src/apps/VaultApp/NotesTreeApp/models/NotesTreeNote';
export * from './src/apps/VaultApp/NoteBlocksApp/models/NoteBlockModel';
export * from './src/lib/toObserver';
export { BlockModelsRegistry } from './src/apps/VaultApp/NoteBlocksApp/models/BlockModelsRegistry';
export { FocusedBlock } from './src/apps/VaultApp/NoteBlocksApp/views/FocusedBlock';
export { FocusedBlockState } from './src/apps/VaultApp/NoteBlocksApp/views/FocusedBlock';
export type { EditState } from './src/apps/VaultApp/NoteBlocksApp/views/FocusedBlock';
import 'reflect-metadata';
import { VaultApplication } from './src/newApps/VaultApplication/VaultApplication';

new VaultApplication('123').start();
