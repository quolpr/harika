import React, { ChangeEvent, useCallback, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import { Note as NoteModel } from '@harika/harika-notes';
import './styles.css';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useTable } from '../../hooks/useTable';
import { useEffect } from 'react';
import { useState } from 'react';

export const Note: React.FC<{ note: NoteModel }> = React.memo(({ note }) => {
  const database = useDatabase();

  note = useTable(note);
  const noteBlocks = useTable(note.childNoteBlocks);

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

    database.action(async () => {
      await note.update((toUpdate) => {
        toUpdate.title = editState.title;
      });
    });
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
    </div>
  );
});
