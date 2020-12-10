import React, { ChangeEvent, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import { Note as NoteModel } from '@harika/harika-notes';
import './styles.css';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useTable } from '../../hooks/useTable';

export const Note: React.FC<{ note: NoteModel }> = React.memo(({ note }) => {
  const database = useDatabase();

  note = useTable(note);
  const noteBlocks = useTable(note.childNoteBlocks);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      database.action(async () => {
        await note.update((toUpdate) => {
          toUpdate.title = e.target.value;
        });
      });
    },
    [database, note]
  );

  return (
    <div className="note">
      <h2 className="note__header">
        <TextareaAutosize
          className="note__input"
          value={note.title}
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
