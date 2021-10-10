import { observer } from 'mobx-react-lite';
import React from 'react';
import { useMedia } from 'react-use';
import { NoteBlock, NoteBlockChildren } from '../NoteBlock/NoteBlock';
import { Toolbar } from './Toolbar';
import { NoteBlocksHandlers } from './NoteBlocksHandlers';
import type { NoteModel } from '@harika/web-core';
import { useVaultService } from '../../contexts/CurrentNotesServiceContext';
import { useObservable, useObservableState } from 'observable-hooks';
import { map } from 'rxjs';
import { LinkedBlocksOfBlocksProvider } from '../LinkedBlocksOfBlocksContext';
import { bem } from '../../utils';

const noteClass = bem('note');

export const NoteBlocks = observer(({ note }: { note: NoteModel }) => {
  const notesService = useVaultService();
  const isWide = useMedia('(min-width: 768px)');

  const scope$ = useObservable(
    ($inputs) => {
      return notesService.getBlocksScope$(
        $inputs.pipe(
          map(([note]) => ({ noteId: note.$modelId, scopedBy: note })),
        ),
      );
    },
    [note],
  );

  const scope = useObservableState(scope$, undefined);

  return (
    <LinkedBlocksOfBlocksProvider noteId={note.$modelId}>
      {scope && <NoteBlocksHandlers scope={scope} note={note} />}

      <div className={noteClass('body')}>
        {scope && (
          <NoteBlockChildren
            parent={scope.rootScopedBlock}
            scope={scope}
            childBlocks={scope.rootScopedBlock.withEmptyChildren}
          />
        )}
      </div>

      {!isWide && scope && <Toolbar scope={scope} />}

      {scope && scope.blocksWithoutParent.length > 0 && (
        <h3 className={noteClass('conflictedBlocksTitle')}>
          [icon] Conflicted blocks (?)
        </h3>
      )}

      {scope &&
        scope.blocksWithoutParent.map((block) => {
          return (
            <>
              <NoteBlock key={block.$modelId} noteBlock={block} scope={scope} />

              <div className={noteClass('conflictedActions')}>
                <button
                  className={noteClass('conflictedActionBtn')}
                  onClick={() => scope?.moveToRoot(block)}
                >
                  Add to root
                </button>
                <button
                  className={noteClass('conflictedActionBtn')}
                  onClick={() => block.delete()}
                >
                  Delete
                </button>
              </div>
            </>
          );
        })}
    </LinkedBlocksOfBlocksProvider>
  );
});
