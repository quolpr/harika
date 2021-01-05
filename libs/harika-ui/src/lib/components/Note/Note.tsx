import React, { ChangeEvent, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NoteBlockModel, NoteModel, NoteLinkModel } from '@harika/harika-core';
import { Link, useHistory } from 'react-router-dom';
import { Link as LinkIcon } from 'heroicons-react';
import groupBy from 'lodash.groupby';
import {
  CurrentFocusedBlockContext,
  ICurrentFocusedBlockState,
} from '@harika/harika-utils';

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
            <div className="mt-5" key={note.$modelId}>
              <div>
                Note: <Link to={`/notes/${note.$modelId}`}>{note.title}</Link>
              </div>
              {links.map((currentLink) => {
                const noteBlock = currentLink.noteBlockRef.current;

                return <NoteBlock noteBlock={noteBlock} />;
              })}
            </div>
          );
        })}
      </>
    );
  }
);

const NoteBlocks = observer(
  ({ childBlocks }: { childBlocks: NoteBlockModel[] }) => {
    return (
      <div className="note__body">
        {childBlocks.map((noteBlock) => (
          <NoteBlock key={noteBlock.$modelId} noteBlock={noteBlock} />
        ))}
      </div>
    );
  }
);

export const Note: React.FC<{ note: NoteModel }> = observer(({ note }) => {
  const stateActions = useState<ICurrentFocusedBlockState>();

  const [editState, setEditState] = useState({
    title: note.title,
    id: note.$modelId,
  });
  const history = useHistory();

  useEffect(() => {
    setEditState({ title: note.title, id: note.$modelId });
  }, [note.$modelId, note.title]);

  useEffect(() => {
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

      <CurrentFocusedBlockContext.Provider value={stateActions}>
        <NoteBlocks childBlocks={note.children} />
      </CurrentFocusedBlockContext.Provider>

      <div className="note__linked-references">
        <LinkIcon className="mr-2" size={16} />
        {note.noteBlockLinks.length} Linked References
      </div>

      <Backlinks noteBlockLinks={note.noteBlockLinks} />
    </div>
  );
});
