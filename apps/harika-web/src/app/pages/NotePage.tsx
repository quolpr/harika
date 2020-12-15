import React, { useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Note } from '../components/Note/Note';
import 'react-calendar/dist/Calendar.css';
import {
  CurrentNoteContext,
  useCurrentNote,
  useHarikaStore,
} from '@harika/harika-core';

export const NotePage = React.memo(() => {
  const store = useHarikaStore();
  const { id } = useParams<{ id: string }>();
  const [, setCurrentNote] = useContext(CurrentNoteContext);

  useEffect(() => {
    const callback = async () => {
      const note = await store.findNote(id);
      setCurrentNote(note);
    };

    callback();

    return () => setCurrentNote(undefined);
  }, [setCurrentNote, store, id]);

  const note = useCurrentNote();

  return note ? <Note note={note} /> : null;
});
