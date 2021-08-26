import { observer } from 'mobx-react-lite';
import React from 'react';
import { useMedia } from 'react-use';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { Toolbar } from './Toolbar';
import { NoteBlocksHandlers } from './NoteBlocksHandlers';
import type { BlocksViewModel, NoteModel } from '@harika/web-core';
import { useNoteService } from '../../contexts/CurrentNotesServiceContext';
import { useObservable, useObservableState } from 'observable-hooks';
import { map } from 'rxjs';

export const NoteBlocks = observer(
  ({ view, note }: { view: BlocksViewModel; note: NoteModel }) => {
    const noteRepo = useNoteService();
    const isWide = useMedia('(min-width: 768px)');

    const blocksTreeHolder$ = useObservable(
      ($inputs) => {
        return noteRepo.getBlocksTreeHolder$($inputs.pipe(map(([id]) => id)));
      },
      [note.$modelId],
    );

    const blocksTreeHolder = useObservableState(blocksTreeHolder$, undefined);

    return (
      <>
        {blocksTreeHolder && (
          <NoteBlocksHandlers
            view={view}
            note={note}
            blocksTreeHolder={blocksTreeHolder}
          />
        )}

        <div className="note__body">
          {blocksTreeHolder &&
            blocksTreeHolder.rootBlock?.noteBlockRefs.map((noteBlock) => (
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
