import { observer } from 'mobx-react-lite';
import React from 'react';
import { useMedia } from 'react-use';
import { Toolbar } from './Toolbar';
import { useObservable, useObservableState } from 'observable-hooks';
import { switchMap } from 'rxjs';
import { LinkedBlocksOfBlocksProvider } from '../LinkedBlocksOfBlocksContext';
import { bem } from '../../utils';
import { useBlocksScopesService } from '../../hooks/vaultAppHooks';
import {
  CollapsableBlock,
  getCollapsableBlock,
  NoteBlock,
  TextBlock as TextBlockModel,
} from '@harika/web-core';
import { BlocksHandlers } from './BlocksHandlers';
import { BlocksChildren, TextBlockComponent } from '../TextBlock/TextBlock';

const noteClass = bem('note');

export const ChildrenBlocks = observer(({ note }: { note: NoteBlock }) => {
  const blocksScopeService = useBlocksScopesService();
  const isWide = useMedia('(min-width: 768px)');

  const scope$ = useObservable(
    ($inputs) => {
      return $inputs.pipe(
        switchMap(([note]) => {
          return blocksScopeService.getBlocksScope$(note, note.$modelId);
        }),
      );
    },
    [note],
  );

  const scope = useObservableState(scope$, undefined);
  const collapsableNote = (scope && getCollapsableBlock(scope, note)) as
    | CollapsableBlock<NoteBlock>
    | undefined;

  return (
    <LinkedBlocksOfBlocksProvider noteId={note.$modelId}>
      {scope && collapsableNote && (
        <BlocksHandlers scope={scope} rootBlock={collapsableNote} />
      )}

      <div className={noteClass('body')}>
        {scope && collapsableNote && (
          <BlocksChildren
            parent={collapsableNote}
            scope={scope}
            childBlocks={collapsableNote.childrenBlocks}
          />
        )}
      </div>

      {!isWide && scope && <Toolbar scope={scope} />}
    </LinkedBlocksOfBlocksProvider>
  );
});
