import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { Arrow } from '../Arrow/Arrow';
import { Link } from 'react-router-dom';
import type { BlocksScope, NoteModel } from '@harika/web-core';
import { TextBlock } from '../NoteBlock/NoteBlock';
import { NoteBlocksHandlers } from './NoteBlocksHandlers';
import {
  useHandleNoteClickOrPress,
  useNotePath,
} from '../../contexts/StackedNotesContext';

const LinkedBlock = observer(
  ({ note, scope }: { note: NoteModel; scope: BlocksScope }): JSX.Element => {
    const rootView = scope.rootScopedBlock;
    const path = rootView?.path;

    if (!path || !rootView) return <></>;

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
                {n.content.currentValue.trim().length === 0
                  ? '[blank]'
                  : n.content.currentValue}
              </div>
            ))}
          </div>
        )}

        <NoteBlocksHandlers note={note} scope={scope} />

        <TextBlock block={rootView} scope={scope} />
      </div>
    );
  },
);

export const BacklinkedNote = observer(
  ({ note, scopes }: { note: NoteModel; scopes: BlocksScope[] }) => {
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
          {scopes.map((scope) => (
            <LinkedBlock key={scope.$modelId} note={note} scope={scope} />
          ))}
        </div>
      </div>
    );
  },
);
