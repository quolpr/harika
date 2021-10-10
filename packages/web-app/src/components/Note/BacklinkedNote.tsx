import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { useCurrentNote } from '../../hooks/useCurrentNote';
import { useCurrentVaultApp } from '../../hooks/useCurrentVaultApp';
import { useHandleClick } from '../../hooks/useNoteClick';
import { Arrow } from '../Arrow/Arrow';
import { Link, useLocation } from 'react-router-dom';
import { paths } from '../../paths';
import type { BlocksScope, NoteModel } from '@harika/web-core';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { NoteBlocksHandlers } from './NoteBlocksHandlers';

const LinkedBlock = observer(
  ({ note, scope }: { note: NoteModel; scope: BlocksScope }): JSX.Element => {
    const rootView = scope.rootScopedBlock;
    const path = rootView.path;

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

        <NoteBlock noteBlock={rootView} scope={scope} />
      </div>
    );
  },
);

export const BacklinkedNote = observer(
  ({ note, scopes }: { note: NoteModel; scopes: BlocksScope[] }) => {
    const vault = useCurrentVaultApp();
    const [isExpanded, setIsExpanded] = useState(true);
    const currentNote = useCurrentNote();
    const location = useLocation();

    const handleClick = useHandleClick(
      vault,
      currentNote?.$modelId,
      note?.$modelId,
    );

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
          <Link
            to={
              note
                ? paths.vaultNotePath({
                    vaultId: vault.$modelId,
                    noteId: note.$modelId,
                  }) + location.search
                : ''
            }
            onClick={handleClick}
          >
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
