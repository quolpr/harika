import {
  CollapsableBlock,
  getBlocksSelection,
  getCollapsableBlock,
  NoteBlock,
} from '@harika/web-core';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { useAsync, useMedia } from 'react-use';

import { useBlocksScopesService } from '../../hooks/vaultAppHooks';
import { bem } from '../../utils';
import { LinkedBlocksOfBlocksProvider } from '../LinkedBlocksOfBlocksContext';
import { BlocksChildren } from '../TextBlock/TextBlock';
import { BlocksHandlers } from './BlocksHandlers';
import { Toolbar } from './Toolbar';

const noteClass = bem('note');

export const ChildrenBlocks = observer(({ note }: { note: NoteBlock }) => {
  const blocksScopeService = useBlocksScopesService();
  const isWide = useMedia('(min-width: 768px)');

  const loadingScope = useAsync(() => {
    return blocksScopeService.getBlocksScope(note, note.$modelId);
  }, [note]);
  const scope = loadingScope.loading
    ? undefined
    : loadingScope.value?.scopeId === note.$modelId
    ? loadingScope.value
    : undefined;

  const collapsableNote = (scope && getCollapsableBlock(scope, note)) as
    | CollapsableBlock<NoteBlock>
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
            parent={collapsableNote}
            scope={scope}
            childBlocks={collapsableNote.childrenBlocks}
            blocksSelection={blocksSelection}
          />
        )}
      </div>

      {!isWide && scope && <Toolbar scope={scope} />}
    </LinkedBlocksOfBlocksProvider>
  );
});
