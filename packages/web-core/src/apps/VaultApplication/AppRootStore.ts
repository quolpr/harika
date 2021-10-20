import { Model, model, prop } from 'mobx-keystone';
import { BlocksScopeStore } from './BlocksScopeExtension/app/models/BlocksScopeStore';
import { NoteBlocksExtensionStore } from './NoteBlocksExtension/app/models/NoteBlocksExtensionStore';
import { NotesStore } from './NotesExtension/app/models/NotesStore';

@model('harika/VaultAppRootStore')
export class VaultAppRootStore extends Model({
  notesStore: prop<NotesStore>(),
  blocksScopeStore: prop<BlocksScopeStore>(),
  noteBlocksStore: prop<NoteBlocksExtensionStore>(),
}) {}
