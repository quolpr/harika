import React from 'react';
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
import { Note as NoteModel } from '@harika/harika-notes';
import { Q } from '@nozbe/watermelondb';
import { useTableCustomSwitch } from '../hooks/useTable';

export const NotePage = React.memo(() => {
  const database = useDatabase();
  const history = useHistory();
  const { id } = useParams<{ id: string }>();

  const note = useTableCustomSwitch(
    (val) =>
      database.collections
        .get<NoteModel>(HarikaNotesTableName.NOTES)
        .query(Q.where('id', val[0]))
        .observe(),
    [id]
  )?.[0];

  return note ? (
    <>
      {note.dailyNoteDate ? (
        <Calendar
          onChange={async (date) => {
            if (isArray(date)) return;

            const note = await getOrCreateDailyNote(database, dayjs(date));

            history.replace(`/notes/${note.id}`);
          }}
          value={note.dailyNoteDate}
        />
      ) : null}
      <Note note={note} />
    </>
  ) : null;
});
