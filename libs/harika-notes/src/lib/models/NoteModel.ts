import { computed } from 'mobx';
import {
  customRef,
  detach,
  findParent,
  model,
  Model,
  modelAction,
  ModelInstanceCreationData,
  prop,
  Ref,
  tProp_dateTimestamp,
  types,
} from 'mobx-keystone';
import { Optional } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { Store } from '../Store';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';

export const noteRef = customRef<NoteModel>('harika/NoteRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const parent = findParent<Store>(ref, (n) => {
      return n instanceof Store;
    });

    if (!parent) return undefined;

    return parent.notesMap[ref.id];
  },
  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

@model('harika/NoteModel')
export class NoteModel extends Model({
  title: prop<string>(''),
  dailyNoteDate: tProp_dateTimestamp(types.dateTimestamp),
  updatedAt: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  childBlockRefs: prop<Ref<NoteBlockModel>[]>(() => []),
  areChildrenLoaded: prop<boolean>(false),
  isPersisted: prop<boolean>(false),
  linkedNoteBlocks: prop<Ref<NoteBlockModel>[]>(() => []),
}) {
  @computed
  get store() {
    return findParent<Store>(this, (n) => n instanceof Store) as Store;
  }

  @modelAction
  createBlock(
    attrs: Optional<
      ModelInstanceCreationData<NoteBlockModel>,
      'updatedAt' | 'createdAt' | 'noteRef'
    >
  ) {
    const newNoteBlock = new NoteBlockModel({
      $modelId: uuidv4(),
      updatedAt: new Date(),
      createdAt: new Date(),
      noteRef: noteRef(this),
      ...attrs,
    });

    this.store.blocksMap[newNoteBlock.$modelId] = newNoteBlock;

    return newNoteBlock;
  }

  @modelAction
  updateTitle(newTitle: string) {
    this.linkedNoteBlocks.forEach((noteBlock) => {
      noteBlock.current.content = noteBlock.current.content
        .split(`[[${this.title}]]`)
        .join(`[[${newTitle}]]`);
    });

    this.title = newTitle;
  }
}
