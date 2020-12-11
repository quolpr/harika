import React from 'react';
import { Link } from 'react-router-dom';
import { useCurrentNote } from '../../hooks/useCurrentNote';
import clsx from 'clsx';
import { useRxData } from 'rxdb-hooks';
import { HarikaDatabaseDocuments } from '../../HarikaDatabaseDocuments';
import { NoteDocType, NoteDocument } from '../../models/note';

const TitleLink = ({ note }: { note: NoteDocument }) => {
  const currentNote = useCurrentNote();

  return (
    <Link
      to={`/notes/${note._id}`}
      className={clsx({ 'font-bold': currentNote === note })}
    >
      {note.title}
    </Link>
  );
};

export const Content = () => {
  const { result: notes } = useRxData<NoteDocType>(
    HarikaDatabaseDocuments.NOTES,
    (collection) => collection.find()
  );

  return (
    <div>
      <ul className="list-disc fixed left-0 mt-10 ml-10 pl-8 pr-4 py-3 bg-green-300 rounded max-w-xs break-all">
        {notes.map((note) => (
          <li key={note._id}>
            <TitleLink note={note} />
          </li>
        ))}
      </ul>
    </div>
  );
};
