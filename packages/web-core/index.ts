export * from './src/apps/VaultApp/VaultApp';
export * from './src/apps/UserApp/UserApp';
export type {
  Token,
  NoteRefToken,
  TagToken,
} from './src/lib/blockParser/types';
export { ScopedBlock } from '../web-app/src/views/ScopedBlock';
export { BlocksScope } from './src/newApps/VaultApplication/NoteBlocksExtension/models/BlocksScope';
export * from './src/lib/blockParser/parseStringToTree';
export * from './src/lib/generateId';
export * from './src/newApps/VaultApplication/NotesTreeExtension/models/NotesTreeRegistry';
export * from './src/newApps/VaultApplication/NotesTreeExtension/models/NotesTreeNote';
export * from './src/newApps/VaultApplication/NoteBlocksExtension/models/NoteBlockModel';
export * from './src/lib/toObserver';
export { BlockModelsRegistry } from './src/newApps/VaultApplication/NoteBlocksExtension/models/BlockModelsRegistry';
export { FocusedBlock } from '../web-app/src/views/FocusedBlock';
export { FocusedBlockState } from '../web-app/src/views/FocusedBlock';
export type { EditState } from '../web-app/src/views/FocusedBlock';
import 'reflect-metadata';
import { VaultApplication } from './src/newApps/VaultApplication/VaultApplication';

new VaultApplication('123').start();
