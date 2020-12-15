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
import { NoteBlockModel } from './NoteBlockModel';

@model('harika/NoteMobxModel')
export class NoteModel extends Model({
  title: prop<string>(''),
  dailyNoteDate: tProp_dateTimestamp(types.dateTimestamp),
  updatedAt: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
  childBlockRefs: prop<Ref<NoteBlockModel>[]>(() => []),
}) {
  @modelAction
  createBlock(
    attrs: Optional<
      ModelInstanceCreationData<NoteBlockModel>,
      'updatedAt' | 'createdAt'
    >
  ) {
    const newNoteBlock = new NoteBlockModel({
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
