import React, { useEffect } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { Note } from '../components/Note/Note';
import 'react-calendar/dist/Calendar.css';
import Calendar from 'react-calendar';
import dayjs from 'dayjs';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import {
  getOrCreateDailyNote,
  HarikaNotesTableName,
} from '@harika/harika-notes';
import { isArray } from 'util';
import { useObservable, useObservableState } from 'observable-hooks';
import { Note as NoteModel } from '@harika/harika-notes';
import { Q } from '@nozbe/watermelondb';

export const NotePage = () => {
  const database = useDatabase();
  const history = useHistory();
  const { id } = useParams<{ id: string }>();

  const input$ = useObservable(
    () =>
      database.collections
        .get<NoteModel>(HarikaNotesTableName.NOTES)
        .query(Q.where('id', id))
        .observe(),
    [id]
  );
  const note = useObservableState(input$, null)?.[0];

  console.log(note?.title, id);

  return (
    <>
      {note && (
        <Calendar
          onChange={async (date) => {
            if (isArray(date)) return;

            const note = await getOrCreateDailyNote(database, dayjs(date));

            history.replace(`/notes/${note.id}`);
          }}
          value={dayjs(note.title, 'D MMM YYYY').toDate()}
        />
      )}
      <Note noteId={id} />
    </>
  );
};
