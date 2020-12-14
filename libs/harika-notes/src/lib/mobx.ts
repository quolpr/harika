import {computed} from 'mobx';
import {
  detach,
  model,
  Model,
  prop,
  prop_mapObject,
  Ref,
  rootRef,
} from 'mobx-keystone';
const noteBlockRef = rootRef<NoteBlock>('harika/NoteBlockRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },
  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

@model('harika/NoteBlock')
export class NoteBlock extends Model({
  id: prop<string>(),
  chilBlocks: prop<Ref<NoteBlock>[]>(() => []),
  parentBlock: prop<Ref<NoteBlock> | undefined>(),
  content: prop<string>(),
  updatedAt: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
}) {
@computed
get allSiblings() {
  if ()
}
}

@model('harika/NoteBlocksStore')
export class NoteBlocksStore extends Model({
  ids: prop<Ref<NoteBlock>[]>(() => []),
  list: prop_mapObject(() => new Map<string, NoteBlock>()),
}) {}

const rootStore = new NoteBlocksStore({
  ids: [noteBlockRef('123')],
  list: new Map([
    [
      '123',
      new NoteBlock({
        id: '123',
        chilBlocks: [],
        parentBlock: undefined,
        content: 'heyy',
        updatedAt: new Date(),
        createdAt: new Date(),
      }),
    ],
  ]),
});
