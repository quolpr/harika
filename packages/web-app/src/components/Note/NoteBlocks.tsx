import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import { useAsync, useMedia } from 'react-use';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { Toolbar } from './Toolbar';
import { NoteBlocksHandlers } from './NoteBlocksHandlers';
import type { BlocksViewModel, NoteModel } from '@harika/web-core';
import type { BlocksTreeHolder } from '@harika/web-core';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';

export const NoteBlocks = observer(
  ({ view, note }: { view: BlocksViewModel; note: NoteModel }) => {
    const noteRepo = useNoteRepository();
    const isWide = useMedia('(min-width: 768px)');

    const blockTreeHolderState = useAsync(
      () => noteRepo.getBlocksTreeHolder(note.$modelId),
      [noteRepo, note.$modelId],
    );

    return (
      <>
        {blockTreeHolderState.value && (
          <NoteBlocksHandlers
            view={view}
            note={note}
            blocksTreeHolder={blockTreeHolderState.value}
          />
        )}

        <div className="note__body">
          {blockTreeHolderState.value &&
            blockTreeHolderState.value.rootBlock.noteBlockRefs.map(
              (noteBlock) => (
                <NoteBlock
                  key={noteBlock.current.$modelId}
                  noteBlock={noteBlock.current}
                  view={view}
                />
              ),
            )}
        </div>

        {!isWide && <Toolbar view={view} />}
      </>
    );
  },
);
