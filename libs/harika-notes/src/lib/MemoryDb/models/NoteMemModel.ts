import {
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
import { NoteBlockMemModel } from './NoteBlockMemModel';

@model('harika/NoteMemModel')
export class NoteMemModel extends Model({
  title: prop<string>(''),
  dailyNoteDate: tProp_dateTimestamp(types.dateTimestamp),
  updatedAt: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  blocksMap: prop<Record<string, NoteBlockMemModel>>(() => ({})),
  childBlockRefs: prop<Ref<NoteBlockMemModel>[]>(() => []),
}) {
  @modelAction
  createBlock(
    attrs: Optional<
      ModelInstanceCreationData<NoteBlockMemModel>,
      'updatedAt' | 'createdAt'
    >
  ) {
    const newNoteBlock = new NoteBlockMemModel({
      $modelId: uuidv4(),
      updatedAt: new Date(),
      createdAt: new Date(),
      ...attrs,
    });

    this.blocksMap[newNoteBlock.$modelId] = newNoteBlock;

    return newNoteBlock;
  }

  @modelAction
  updateTitle(newTitle: string) {
    this.title = newTitle;
  }
}
