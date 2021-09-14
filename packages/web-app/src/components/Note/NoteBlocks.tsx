import { observer } from 'mobx-react-lite';
import React from 'react';
import { useMedia } from 'react-use';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { Toolbar } from './Toolbar';
import { NoteBlocksHandlers } from './NoteBlocksHandlers';
import type { NoteModel } from '@harika/web-core';
import { useNotesService } from '../../contexts/CurrentNotesServiceContext';
import { useObservable, useObservableState } from 'observable-hooks';
import { map } from 'rxjs';

export const NoteBlocks = observer(({ note }: { note: NoteModel }) => {
  const noteRepo = useNotesService();
  const isWide = useMedia('(min-width: 768px)');

  const scope$ = useObservable(
    ($inputs) => {
      return noteRepo.getBlocksScope$(
        $inputs.pipe(
          map(([note]) => ({ noteId: note.$modelId, scopedBy: note })),
        ),
      );
    },
    [note],
  );

  const scope = useObservableState(scope$, undefined);

  return (
    <>
      {scope && <NoteBlocksHandlers scope={scope} note={note} />}

      <div className="note__body">
        {scope &&
          scope.rootScopedBlock.children.map((noteBlock) => (
            <NoteBlock
              key={noteBlock.$modelId}
              noteBlock={noteBlock}
              scope={scope}
            />
          ))}
      </div>

      {!isWide && scope && <Toolbar scope={scope} />}
    </>
  );
});
