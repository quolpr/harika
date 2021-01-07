import { useCurrentVault } from '@harika/harika-utils';
import { observer } from 'mobx-react-lite';
import React, { useEffect } from 'react';
import './styles.css';
import { NoteModel } from '@harika/harika-core';
import { Link } from 'react-router-dom';
import ReactTimeAgo from 'react-time-ago';

import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';

TimeAgo.addDefaultLocale(en);

const NoteRow = observer(({ note }: { note: NoteModel }) => {
  return (
    <tr>
      <td className="pl-1">
        <Link to={`/notes/${note.$modelId}`}>{note.title}</Link>
      </td>
      <td className="notes-table__time">
        <ReactTimeAgo date={note.createdAt} locale="en-US" />
      </td>
      <td />
    </tr>
  );
});

export const NotesPage = observer(() => {
  const vault = useCurrentVault();

  useEffect(() => {
    const callback = async () => {
      await vault.preloadAllNotes();
    };

    callback();
  });

  return (
    <table className="notes-table">
      <thead>
        <tr>
          <th className="w-1/2 pb-2 text-left">Title</th>
          <th className="w-1/4 pb-2">Created At</th>
          <th className="w-1/4 pb-2">Updated At</th>
        </tr>
      </thead>
      <tbody>
        {vault.allNotes
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((note) => (
            <NoteRow note={note} key={note.$modelId} />
          ))}
      </tbody>
    </table>
  );
});
