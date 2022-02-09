import dayjs from 'dayjs';
import {
  ModelCreationData,
  standaloneAction,
  withoutUndo,
} from 'mobx-keystone';
import type { Optional, Required } from 'utility-types';

import { generateId } from '../../../../lib/generateId';
import { blockRef } from './BaseBlock';
import { BlocksStore } from './BlocksStore';
import { NoteBlock } from './NoteBlock';
import { TextBlock } from './TextBlock';

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
    const updatedAt = createdAt;

    const emptyTextBlock = new TextBlock({
      id: generateId(),
      createdAt,
      updatedAt,
      content: '',
      orderPosition: 0,
      areChildrenLoaded: true,
      parentRef: blockRef(noteId),
    });

    const noteBlock = new NoteBlock({
      id: noteId,
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
