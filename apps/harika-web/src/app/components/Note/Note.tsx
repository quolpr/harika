import React, { ChangeEvent, useCallback } from 'react';
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

  const [title, setTitle] = useState(note.title);

  useEffect(() => {
    setTitle(note.title);
  }, [note.title]);

  useEffect(() => {
    if (note.title === title) return;

    database.action(async () => {
      await note.update((toUpdate) => {
        toUpdate.title = title;
      });
    });
  }, [note, database, title]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value);
  }, []);

  return (
    <div className="note">
      <h2 className="note__header">
        <TextareaAutosize
          className="note__input"
          value={title}
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
