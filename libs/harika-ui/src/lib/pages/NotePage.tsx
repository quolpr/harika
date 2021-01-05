import React, { useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import 'react-calendar/dist/Calendar.css';
import {
  CurrentNoteContext,
  useCurrentNote,
  useCurrentVault,
} from '@harika/harika-utils';
import { Note } from '../components/Note/Note';

export const NotePage = React.memo(() => {
  const vault = useCurrentVault();
  const { id } = useParams<{ id: string }>();
  const [, setCurrentNote] = useContext(CurrentNoteContext);

  useEffect(() => {
    const callback = async () => {
      const note = await vault.findNote(id);
      setCurrentNote(note);
    };

    callback();

    return () => setCurrentNote(undefined);
  }, [setCurrentNote, vault, id]);

  const note = useCurrentNote();

  return note ? <Note note={note} /> : null;
});
