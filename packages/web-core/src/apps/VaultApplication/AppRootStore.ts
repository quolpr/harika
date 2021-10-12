import { Model, model, prop } from 'mobx-keystone';
import { BlocksScopeStore } from './BlocksScopeExtension/models/BlocksScopeStore';
import { NoteBlocksExtensionStore } from './NoteBlocksExtension/models/NoteBlocksExtensionStore';
import { NotesStore } from './NotesExtension/models/NotesStore';

@model('harika/VaultAppRootStore')
export class VaultAppRootStore extends Model({
  notesStore: prop<NotesStore>(),
  blocksScopeStore: prop<BlocksScopeStore>(),
  noteBlocksStore: prop<NoteBlocksExtensionStore>(),
}) {}