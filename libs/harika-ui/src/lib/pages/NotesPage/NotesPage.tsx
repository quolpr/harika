import { observer } from 'mobx-react-lite';
import React, { useEffect, useState } from 'react';
import './styles.css';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { paths } from '../../paths';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';

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
        <TimeAgo date={note.createdAt} />
      </td>
      <td />
    </tr>
  );
});

export const NotesPage = () => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();

  const [noteTuples, setNoteTuples] = useState<
    {
      id: string;
      title: string;
      createdAt: Date;
    }[]
  >([]);

  useEffect(() => {
    const callback = async () => {
      setNoteTuples(await noteRepo.getAllNotesTuples(vault.$modelId));
    };

    callback();
  }, [vault.$modelId, noteRepo]);

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
