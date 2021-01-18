import React, { ChangeEvent, useCallback, useMemo } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  NoteBlockModel,
  NoteModel,
  NoteLinkModel,
  BlocksViewModel,
} from '@harika/harika-core';
import { Link, useHistory } from 'react-router-dom';
import { Link as LinkIcon } from 'heroicons-react';
import groupBy from 'lodash.groupby';
import {
  CurrentFocusedBlockContext,
  ICurrentFocusedBlockState,
  useCurrentVault,
} from '@harika/harika-utils';
import clsx from 'clsx';
import { Arrow } from '../Arrow/Arrow';
import { paths } from '../../paths';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

const BacklinkedNote = observer(
  ({ note, links }: { note: NoteModel; links: NoteLinkModel[] }) => {
    const vault = useCurrentVault();
    const [isExpanded, setIsExpanded] = useState(true);

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
            to={paths.vaultNotePath({
              vaultId: vault.$modelId,
              noteId: note.$modelId,
            })}
          >
            {note.title}
          </Link>
        </div>

        <div
          className={clsx('backlinked-note__noteblocks', {
            'backlinked-note__noteblocks--expanded': isExpanded,
          })}
        >
          {links.map((currentLink) => {
            const noteBlock = currentLink.noteBlockRef.current;
            const path = noteBlock.path;

            return (
              <div
                key={currentLink.$modelId}
                className="backlinked-note__noteblock-root"
              >
                {path.length > 0 && (
                  <div className="backlinked-note__noteblock-path">
                    {path.map((n, i) => (
                      <div
                        className={clsx(
                          'backlinked-note__noteblock-path-step',
                          {
                            'backlinked-note__noteblock-path-step--last':
                              i === path.length - 1,
                          }
                        )}
                        key={n.$modelId}
                      >
                        {n.content}
                      </div>
                    ))}
                  </div>
                )}
                <NoteBlock
                  noteBlock={noteBlock}
                  view={vault.getOrCreateViewByModel(currentLink)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

const Backlinks = observer(
  ({ noteBlockLinks }: { noteBlockLinks: NoteLinkModel[] }) => {
    return (
      <>
        {Object.entries(
          groupBy(
            noteBlockLinks,
            ({ noteBlockRef }: NoteLinkModel): string =>
              noteBlockRef.current.noteRef.id
          )
        ).map(([, links]) => {
          const note = links[0].noteBlockRef.current.noteRef.current;

          return (
            <BacklinkedNote key={note.$modelId} note={note} links={links} />
          );
        })}
      </>
    );
  }
);

const NoteBlocks = React.memo(
  observer(
    ({
      childBlocks,
      view,
    }: {
      childBlocks: NoteBlockModel[];
      view: BlocksViewModel;
    }) => {
      return (
        <div className="note__body">
          {childBlocks.map((noteBlock) => (
            <NoteBlock
              key={noteBlock.$modelId}
              noteBlock={noteBlock}
              view={view}
            />
          ))}
        </div>
      );
    }
  )
);

export const Note: React.FC<{ note: NoteModel }> = observer(({ note }) => {
  const vault = useCurrentVault();
  const history = useHistory<IFocusBlockState>();
  const focusOnBlockId = (history.location.state || {}).focusOnBlockId;
  const stateActions = useState<ICurrentFocusedBlockState>(
    focusOnBlockId ? { noteBlock: vault.blocksMap[focusOnBlockId] } : undefined
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoziedStateActions = useMemo(() => stateActions, stateActions);

  const [editState, setEditState] = useState({
    title: note.title,
    id: note.$modelId,
  });

  useEffect(() => {
    if (note.title === editState.title && note.$modelId === editState.id)
      return;

    setEditState({ title: note.title, id: note.$modelId });
  }, [editState.id, editState.title, note.$modelId, note.title]);

  useEffect(() => {
    if (note.title === editState.title && note.$modelId === editState.id)
      return;
    if (editState.id !== note.$modelId) return;
    if (editState.title === note.title) return;

    note.updateTitle(editState.title);
  }, [editState.id, editState.title, note]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setEditState({ id: note.$modelId, title: e.target.value });
    },
    [note.$modelId]
  );

  const handleDestroy = useCallback(() => {
    note.destroy();

    history.replace(`/`);
  }, [note, history]);

  return (
    <div className="note">
      <h2 className="note__header">
        <TextareaAutosize
          className="note__input"
          value={editState.title}
          onChange={handleChange}
        />
      </h2>

      <CurrentFocusedBlockContext.Provider value={memoziedStateActions}>
        <NoteBlocks
          view={vault.getOrCreateViewByModel(note)}
          childBlocks={note.children}
        />
      </CurrentFocusedBlockContext.Provider>

      <div className="note__linked-references">
        <LinkIcon className="mr-2" size={16} />
        {note.noteBlockLinks.length} Linked References
      </div>

      <Backlinks noteBlockLinks={note.noteBlockLinks} />
    </div>
  );
});
