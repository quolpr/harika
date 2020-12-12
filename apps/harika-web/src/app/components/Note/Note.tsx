import React, { ChangeEvent, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import { Note as NoteModel } from '@harika/harika-notes';
import './styles.css';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTable } from '@harika/harika-core';

const Backlink = ({ noteBlock }: { noteBlock: NoteBlockModel }) => {
  noteBlock = useTable(noteBlock);
  const note = useTable(noteBlock.note);

  return noteBlock && note ? (
    <div className="mt-5">
      <div>
        Note: <Link to={`/notes/${note.id}`}>{note?.title}</Link>
      </div>
      <div>Block content: {noteBlock.content}</div>
    </div>
  ) : null;
};

export const Note: React.FC<{ note: NoteModel }> = React.memo(({ note }) => {
  const database = useDatabase();

  note = useTable(note);
  const noteBlocks = useTable(note.childNoteBlocks);
  const backlinkedBlocks = useTable(note.backlinkedBlocks);

  const [editState, setEditState] = useState({
    title: note.title,
    id: note.id,
  });

  useEffect(() => {
    setEditState({ title: note.title, id: note.id });
  }, [note.id, note.title]);

  useEffect(() => {
    if (editState.id !== note.id) return;
    if (editState.title === note.title) return;

    note.updateTitle(editState.title);
  }, [database, editState.id, editState.title, note]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setEditState({ id: note.id, title: e.target.value });
    },
    [note.id]
  );

  return (
    <div className="note">
      <h2 className="note__header">
        <TextareaAutosize
          className="note__input"
          value={editState.title}
          onChange={handleChange}
        />
      </h2>
      <div className="note__body">
        {NoteBlockModel.sort(noteBlocks || []).map((noteBlock) => (
          <NoteBlock key={noteBlock.id} noteBlock={noteBlock} />
        ))}
      </div>

      <hr />

      {(backlinkedBlocks || []).map((noteBlock) => (
        <Backlink key={noteBlock.id} noteBlock={noteBlock} />
      ))}
    </div>
  );
});
