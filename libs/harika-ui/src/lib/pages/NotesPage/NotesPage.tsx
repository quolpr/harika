import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useState } from 'react';
import './styles.css';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { paths } from '../../paths';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { Trash as TrashIcon } from 'heroicons-react';
import { useObservable, useObservableEagerState } from 'observable-hooks';

type NoteTuple = {
  id: string;
  title: string;
  createdAt: Date;
};

const NoteRow = observer(({ note }: { note: NoteTuple }) => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();

  const handleDelete = useCallback(async () => {
    const noteModel = await noteRepo.findNote(vault, note.id);
    noteModel?.delete();
  }, [note.id, noteRepo, vault]);

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
      <td className="notes-table__action">
        <button onClick={handleDelete}>
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
});

export const NotesPage = () => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();

  const input$ = useObservable(() =>
    noteRepo.getAllNotesTuples$(vault.$modelId)
  );

  const observedNotes = useObservableEagerState(input$) || [];

  return (
    <table className="notes-table">
      <thead>
        <tr>
          <th className="notes-table__title-head">Title</th>
          <th className="notes-table__time-head">Created At</th>
          <th className="notes-table__action-head" />
        </tr>
      </thead>
      <tbody>
        {observedNotes
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((note) => (
            <NoteRow note={note} key={note.id} />
          ))}
      </tbody>
    </table>
  );
};
