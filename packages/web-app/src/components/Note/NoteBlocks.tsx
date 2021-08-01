import { observer } from 'mobx-react-lite';
import React from 'react';
import { useMedia } from 'react-use';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import type { Ref } from 'mobx-keystone';
import { Toolbar } from './Toolbar';
import { NoteBlocksHandlers } from './NoteBlocksHandlers';
import type {
  NoteBlockModel,
  BlocksViewModel,
  NoteModel,
} from '@harika/web-core';

export const NoteBlocks = observer(
  ({
    childBlocks,
    view,
    note,
  }: {
    childBlocks: Ref<NoteBlockModel>[];
    view: BlocksViewModel;
    note: NoteModel;
  }) => {
    const isWide = useMedia('(min-width: 768px)');

    return (
      <>
        <NoteBlocksHandlers view={view} note={note} />

        <div className="note__body">
          {childBlocks.map((noteBlock) => (
            <NoteBlock
              key={noteBlock.current.$modelId}
              noteBlock={noteBlock.current}
              view={view}
            />
          ))}
        </div>

        {!isWide && <Toolbar view={view} />}
      </>
    );
  },
);
