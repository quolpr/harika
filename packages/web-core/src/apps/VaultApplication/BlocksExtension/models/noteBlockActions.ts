import dayjs from 'dayjs';
import {
  ModelCreationData,
  standaloneAction,
  withoutUndo,
} from 'mobx-keystone';
import { BlocksStore } from './BlocksStore';
import { NoteBlock } from './NoteBlock';
import type { Optional, Required } from 'utility-types';
import { generateId } from '../../../../lib/generateId';
import { TextBlock } from './TextBlock';
import { blockRef } from './BaseBlock';

export const createNote = standaloneAction(
  'harika/BlocksExtension/NoteBlock/createNote',
  (
    store: BlocksStore,
    attrs: Required<
      Optional<
        ModelCreationData<NoteBlock>,
        'createdAt' | 'updatedAt' | 'dailyNoteDate' | 'orderPosition'
      >,
      'title'
    >,
    options?: { isDaily?: boolean },
  ) => {
    const noteId = generateId();
    const createdAt = new Date().getTime();
    const updatedAt = new Date().getTime();

    const emptyTextBlock = new TextBlock({
      $modelId: generateId(),
      createdAt,
      updatedAt,
      content: '',
      orderPosition: 0,
      areChildrenLoaded: true,
      parentRef: blockRef(noteId),
    });

    const noteBlock = new NoteBlock({
      $modelId: noteId,
      createdAt,
      updatedAt,
      ...(options?.isDaily
        ? {
            dailyNoteDate: dayjs().startOf('day').unix(),
          }
        : {}),
      orderPosition: 0,
      ...attrs,
    });

    withoutUndo(() => {
      store.registerBlock(noteBlock);
      store.registerBlock(emptyTextBlock);
    });

    return noteBlock;
  },
);
