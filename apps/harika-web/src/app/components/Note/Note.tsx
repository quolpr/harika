import React, { ChangeEvent, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NoteBlockModel, NoteModel } from '@harika/harika-core';
import { Ref } from 'mobx-keystone';
import { Link, useHistory } from 'react-router-dom';
import { Trash as TrashIcon } from 'heroicons-react';

const Backlinks = observer(
  ({ linkedBlockRefs }: { linkedBlockRefs: Ref<NoteBlockModel>[] }) => {
    return (
      <>
        {linkedBlockRefs.map(({ current: noteBlock, $modelId }) => (
          <div className="mt-5" key={$modelId}>
            <div>
              Note:{' '}
              <Link to={`/notes/${noteBlock.noteRef.current.$modelId}`}>
                {noteBlock.noteRef.current.title}
              </Link>
            </div>
            <div>Block content: {noteBlock.content}</div>
          </div>
        ))}
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

        <TrashIcon onClick={handleDestroy} />
      </h2>

      <NoteBlocks childBlocks={note.children} />

      <hr />

      <Backlinks linkedBlockRefs={note.linkedNoteBlockRefs} />
    </div>
  );
});
