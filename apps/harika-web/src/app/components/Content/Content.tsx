import React from 'react';
import { HarikaNotesTableName } from '@harika/harika-notes';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useTable, useTableCustomSwitch } from '../../hooks/useTable';
import { Note as NoteModel } from '@harika/harika-notes';
import { Link } from 'react-router-dom';
import { useCurrentNote } from '../../hooks/useCurrentNote';
import clsx from 'clsx';

const TitleLink = ({ note }: { note: NoteModel }) => {
  const currentNote = useCurrentNote();

  note = useTable(note);
  return (
    <Link
      to={`/notes/${note.id}`}
      className={clsx({ 'font-bold': currentNote === note })}
    >
      {note.title}
    </Link>
  );
};

export const Content = () => {
  const database = useDatabase();

  const notes = useTableCustomSwitch(
    () =>
      database.collections
        .get<NoteModel>(HarikaNotesTableName.NOTES)
        .query()
        .observe(),
    []
  );

  return (
    <div>
      <ul className="list-disc fixed left-0 mt-10 ml-10 pl-8 pr-4 py-3 bg-green-300 rounded">
        {(notes || []).map((note) => (
          <li key={note.id}>
            <TitleLink note={note} />
          </li>
        ))}
      </ul>
    </div>
  );
};
