import {
  BlockView,
  getBlocksSelection,
  getBlockView,
  NoteBlock,
} from '@harika/web-core';
import { observer } from 'mobx-react-lite';
import { useObservable, useObservableState } from 'observable-hooks';
import React from 'react';
import { useMedia } from 'react-use';
import { combineLatest, mapTo, switchMap } from 'rxjs';

import {
  useBlockLinksService,
  useBlocksScopesService,
  useBlocksScopesStore,
} from '../../hooks/vaultAppHooks';
import { bem } from '../../utils';
import { LinkedBlocksOfBlocksProvider } from '../LinkedBlocksOfBlocksContext';
import { BlocksChildren } from '../TextBlock/TextBlock';
import { BlocksHandlers } from './BlocksHandlers';
import { Toolbar } from './Toolbar';

const noteClass = bem('note');

export const ChildrenBlocks = observer(({ note }: { note: NoteBlock }) => {
  const blocksScopesService = useBlocksScopesService();
  const blockLinksService = useBlockLinksService();
  const blocksScopesStore = useBlocksScopesStore();
  const isWide = useMedia('(min-width: 768px)');

  const loader$ = useObservable(
    switchMap(([note]) => {
      return combineLatest([
        blockLinksService.loadLinksOfBlockDescendants$([note.$modelId]),
        blocksScopesService.getBlocksScope(note, note.$modelId),
      ]).pipe(mapTo(true));
    }),
    [note],
  );
  useObservableState(loader$, false);

  const scope = blocksScopesStore.getScope(note, note.$modelId);
  const collapsableNote = (scope && getBlockView(scope, note)) as
    | BlockView<NoteBlock>
    | undefined;

  const blocksSelection =
    scope && collapsableNote && getBlocksSelection(scope, collapsableNote);

  return (
    <LinkedBlocksOfBlocksProvider noteId={note.$modelId}>
      {scope && collapsableNote && (
        <BlocksHandlers scope={scope} rootBlock={collapsableNote} />
      )}

      <div className={noteClass('body')}>
        {scope && collapsableNote && blocksSelection && (
          <BlocksChildren
            scope={scope}
            childBlocks={collapsableNote.childrenBlocks}
            blocksSelection={blocksSelection}
          />
        )}
      </div>

      {!isWide && <Toolbar />}
    </LinkedBlocksOfBlocksProvider>
  );
});
