import React, { useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Note } from '../components/Note/Note';
import 'react-calendar/dist/Calendar.css';
import { useCurrentNote } from '../hooks/useCurrentNote';
import { CurrentNoteIdContext } from '../contexts/CurrentNoteIdContext';

export const NotePage = React.memo(() => {
  const { id } = useParams<{ id: string }>();
  const [, setCurrentNoteId] = useContext(CurrentNoteIdContext);

  useEffect(() => {
    setCurrentNoteId(id);
    return () => setCurrentNoteId(undefined);
  }, [setCurrentNoteId, id]);

  const note = useCurrentNote();

  return note ? <Note note={note} /> : null;
});
