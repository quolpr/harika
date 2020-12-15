import React, { ChangeEvent, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import './styles.css';
import { useEffect } from 'react';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { NoteMemModel } from '@harika/harika-notes';

// const Backlink = ({ noteBlock }: { noteBlock: NoteBlockModel }) => {
//   noteBlock = useTable(noteBlock);
//   const note = useTable(noteBlock.note);
//
//   return noteBlock && note ? (
//     <div className="mt-5">
//       <div>
//         Note: <Link to={`/notes/${note.id}`}>{note?.title}</Link>
//       </div>
//       <div>Block content: {noteBlock.content}</div>
//     </div>
//   ) : null;
// };

export const Note: React.FC<{ note: NoteMemModel }> = observer(({ note }) => {
  const [editState, setEditState] = useState({
    title: note.title,
    id: note.$modelId,
  });

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
        {note.childBlockRefs.map(({ current: noteBlock }) => (
          <NoteBlock key={noteBlock.$modelId} noteBlock={noteBlock} />
        ))}
      </div>

      <hr />
    </div>
  );
});
