import React, { useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import 'react-calendar/dist/Calendar.css';
import {
  CurrentNoteContext,
  useCurrentNote,
  useCurrentVault,
} from '@harika/harika-utils';
import { Note } from '../components/Note/Note';
import { useNoteRepository } from '../contexts/CurrentNoteRepositoryContext';

export const NotePage = React.memo(() => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const { noteId } = useParams<{ noteId: string }>();
  const [, setCurrentNote] = useContext(CurrentNoteContext);

  useEffect(() => {
    const callback = async () => {
      const note = await noteRepo.findNote(vault, noteId);
      setCurrentNote(note);
    };

    callback();

    return () => setCurrentNote(undefined);
  }, [setCurrentNote, vault, noteId, noteRepo]);

  const note = useCurrentNote();

  return note ? <Note note={note} /> : null;
});
