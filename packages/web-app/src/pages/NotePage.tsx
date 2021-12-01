import React from 'react';
import 'react-calendar/dist/Calendar.css';
import { observer } from 'mobx-react-lite';
import { NotesStack } from '../components/NotesStack/NotesStack';
import { useStacks } from '../contexts/StackedNotesContext';

export const NoteStackPage = observer(() => {
  const stacks = useStacks();

  return <NotesStack stacks={stacks} />;
});

export default NoteStackPage;
