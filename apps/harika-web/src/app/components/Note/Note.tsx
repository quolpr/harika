import React, { ChangeEvent, useCallback, useMemo, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import './styles.css';
import { useTable } from '../../hooks/useTable';
import { useEffect } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NoteDocument } from '../../models/note';
import { useIsFocused } from '../../hooks/useIsFocused';
import { useRxDB, useRxDocument, useRxQuery } from 'rxdb-hooks';
import { NoteBlockDocument } from '../../models/noteBlocks';
import { HarikaDatabaseDocuments } from '../../HarikaDatabaseDocuments';
import { HarikaDatabase } from '../../initDb';
import { useObservableEagerState } from 'observable-hooks';

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

const NoteComponent: React.FC<{ note: NoteDocument }> = ({ note }) => {
  const backlinkedBlocks: Array<any> = [];

  const noteBlocks =
    useObservableEagerState(
      useMemo(() => note.getChildNoteBlocks().$, [note])
    ) || [];

  console.log('heYNotete!');

  const [isFocused, attrs] = useIsFocused();

  const [editState, setEditState] = useState({
    title: note.title,
    id: note._id,
  });

  useEffect(() => {
    if (!isFocused) {
      setEditState({ title: note.title, id: note._id });
    }
  }, [note._id, note.title, isFocused]);

  useEffect(() => {
    if (editState.id !== note._id) return;
    if (editState.title === note.title) return;

    note.updateTitle(editState.title);
  }, [editState.id, editState.title, note]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setEditState({ id: note._id, title: e.target.value });
    },
    [note._id]
  );

  return (
    <div className="note">
      <h2 className="note__header">
        <TextareaAutosize
          className="note__input"
          value={editState.title}
          onChange={handleChange}
          {...attrs}
        />
      </h2>
      <div className="note__body">
        {noteBlocks.map((noteBlock) => (
          <NoteBlock key={noteBlock._id} id={noteBlock._id} />
        ))}
      </div>

      <hr />

      {(backlinkedBlocks || []).map((noteBlock) => (
        <Backlink key={noteBlock.id} noteBlock={noteBlock} />
      ))}
    </div>
  );
};

export const Note = React.memo(({ id }: { id: string }) => {
  const db = useRxDB<HarikaDatabase>();

  const note = useObservableEagerState(
    useMemo(() => db.notes.findOne(id).$, [db.notes, id])
  );

  return note ? <NoteComponent note={note} /> : null;
});
