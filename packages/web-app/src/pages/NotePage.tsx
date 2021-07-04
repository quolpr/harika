import React, { useMemo } from 'react';
import 'react-calendar/dist/Calendar.css';
import { observer } from 'mobx-react-lite';
import { useLocation, useParams } from 'react-router-dom';
import queryString from 'query-string';
import { NotesStack } from '../components/NotesStack/NotesStack';

export const NotePage = observer(() => {
  const { noteId } = useParams<{ noteId: string }>();
  const location = useLocation();
  const parsedCurrentQuery = queryString.parse(location.search);

  const allNoteIds = useMemo(
    () =>
      [
        ...(parsedCurrentQuery.stackedIds
          ? [parsedCurrentQuery.stackedIds]
          : []
        ).flat(),
        noteId,
      ] as string[],
    [noteId, parsedCurrentQuery.stackedIds],
  );

  return <NotesStack ids={allNoteIds} />;
});

export default NotePage;
