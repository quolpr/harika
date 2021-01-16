import { useCurrentVault } from '@harika/harika-utils';
import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import './styles.css';
import { Link } from 'react-router-dom';
import ReactTimeAgo from 'react-time-ago';

import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
import { paths } from '../../paths';

TimeAgo.addDefaultLocale(en);

type NoteTuple = {
  id: string;
  title: string;
  createdAt: Date;
};

const NoteRow = observer(({ note }: { note: NoteTuple }) => {
  const vault = useCurrentVault();

  return (
    <tr>
      <td className="pl-1">
        <Link
          to={paths.vaultNotePath({ vaultId: vault.$modelId, noteId: note.id })}
        >
          {note.title}
        </Link>
      </td>
      <td className="notes-table__time">
        <ReactTimeAgo date={note.createdAt} locale="en-US" />
      </td>
      <td />
    </tr>
  );
});

export const NotesPage = () => {
  const vault = useCurrentVault();

  const [noteTuples, setNoteTuples] = useState<
    {
      id: string;
      title: string;
      createdAt: Date;
    }[]
  >([]);

  useEffect(() => {
    const callback = async () => {
      setNoteTuples(await vault.getAllNotesTuples());
    };

    callback();
  }, [vault]);

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
        {noteTuples
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((note) => (
            <NoteRow note={note} key={note.id} />
          ))}
      </tbody>
    </table>
  );
};
