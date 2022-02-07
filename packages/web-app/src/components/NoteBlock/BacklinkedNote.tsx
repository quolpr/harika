import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { Arrow } from '../Arrow/Arrow';
import { Link } from 'react-router-dom';
import {
  BlocksScope,
  CollapsableBlock,
  getBlocksSelection,
  NoteBlock,
} from '@harika/web-core';
import {
  useHandleNoteClickOrPress,
  useNotePath,
} from '../../contexts/StackedNotesContext';
import { BlocksHandlers } from './BlocksHandlers';
import { TextBlockComponent } from '../TextBlock/TextBlock';

const LinkedBlock = observer(
  ({
    note,
    rootBlock,
    scope,
  }: {
    note: NoteBlock;
    rootBlock: CollapsableBlock;
    scope: BlocksScope;
  }): JSX.Element => {
    const path = rootBlock.path;

    const blocksSelection =
      scope && rootBlock && getBlocksSelection(scope, rootBlock);

    return (
      <div className="backlinked-note__noteblock-root">
        {path.length > 1 && (
          <div className="backlinked-note__noteblock-path">
            {path.slice(1).map((n, i) => (
              <div
                className={clsx('backlinked-note__noteblock-path-step', {
                  'backlinked-note__noteblock-path-step--last':
                    i === path.length - 1,
                })}
                key={n.$modelId}
              >
                {n.originalBlock.toString().trim().length === 0
                  ? '[blank]'
                  : n.originalBlock.toString()}
              </div>
            ))}
          </div>
        )}

        <BlocksHandlers rootBlock={rootBlock} scope={scope} />

        <TextBlockComponent
          block={rootBlock}
          scope={scope}
          blocksSelection={blocksSelection}
        />
      </div>
    );
  },
);

export const BacklinkedNote = observer(
  ({
    note,
    scopesWithBlocks,
  }: {
    note: NoteBlock;
    scopesWithBlocks: { scope: BlocksScope; rootBlock: CollapsableBlock }[];
  }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const notePath = useNotePath();
    const handleClick = useHandleNoteClickOrPress(note?.$modelId);

    return (
      <div className="backlinked-note">
        <div
          className={clsx('backlinked-note__title', {
            'backlinked-note__title--expanded': isExpanded,
          })}
        >
          <Arrow
            className="backlinked-note__arrow"
            isExpanded={isExpanded}
            onToggle={() => {
              setIsExpanded(!isExpanded);
            }}
          />
          <Link to={note ? notePath(note.$modelId) : ''} onClick={handleClick}>
            {note.title}
          </Link>
        </div>

        <div
          className={clsx('backlinked-note__noteblocks', {
            'backlinked-note__noteblocks--expanded': isExpanded,
          })}
        >
          {scopesWithBlocks.map(({ scope, rootBlock }) => (
            <LinkedBlock
              key={rootBlock.$modelId}
              note={note}
              scope={scope}
              rootBlock={rootBlock}
            />
          ))}
        </div>
      </div>
    );
  },
);
