import {
  customRef,
  detach,
  findParent,
  model,
  Model,
  modelAction,
  ModelCreationData,
  prop,
  tProp,
  types,
} from 'mobx-keystone';
import { isVault } from './utils';
import type { VaultModel } from './VaultModel';

export interface INoteLoadStatus {
  areBlockLinksLoaded: boolean;
  areChildrenLoaded: boolean;
  areNoteLinksLoaded: boolean;
}

export const noteRef = customRef<NoteModel>('harika/NoteRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const vault = findParent<VaultModel>(this, isVault);

    if (!vault) {
      return undefined;
    }

    return vault.notesMap[ref.id];
  },

  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

const modelType = 'harika/NoteModel' as const;

export const generateRootBlockId = (noteId: string) => `${noteId}-rootBlock`;
export const generateConflictedRootBlockId = (noteId: string) =>
  `${noteId}-conflictedRootBlock`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNoteModel = (model: any): model is NoteModel =>
  '$modelType' in model && model.$modelType === modelType;

@model(modelType)
export class NoteModel extends Model({
  title: prop<string>(),
  dailyNoteDate: tProp(types.maybe(types.dateTimestamp)),
  createdAt: tProp(types.dateTimestamp),
  isDeleted: prop<boolean>(false),
  rootBlockId: prop<string>(),
}) {
  updateAttrs(attrs: ModelCreationData<NoteModel>) {
    this.title = attrs.title;
    this.dailyNoteDate = attrs.dailyNoteDate;
    this.createdAt = attrs.createdAt;

    if (this.rootBlockId !== attrs.rootBlockId) {
      this.rootBlockId = attrs.rootBlockId;
    }

    if (
      attrs.isDeleted !== undefined &&
      attrs.isDeleted !== null &&
      attrs.isDeleted !== this.isDeleted
    ) {
      this.isDeleted = attrs.isDeleted;
    }
  }
}
