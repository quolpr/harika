import './styles.css';

import { TrashIcon } from '@heroicons/react/solid';
import { observer } from 'mobx-react-lite';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useCallback, useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';

import { LoadingDoneSubjectContext } from '../../contexts';
import { useNotePath } from '../../contexts/StackedNotesContext';
import {
  useDeleteBlocksService,
  useNoteBlocksService,
} from '../../hooks/vaultAppHooks';

type NoteTuple = {
  id: string;
  title: string;
  createdAt: Date;
};

const NoteRow = observer(({ note }: { note: NoteTuple }) => {
  const deleteBlocksService = useDeleteBlocksService();

  const handleDelete = useCallback(async () => {
    deleteBlocksService.deleteBlock(note.id);
  }, [deleteBlocksService, note.id]);

  const notePath = useNotePath();

  return (
    <tr>
      <td className="pl-1">
        <Link to={notePath(note.id)}>{note.title}</Link>
      </td>
      <td className="notes-table__time">
        <TimeAgo date={note.createdAt} />
      </td>
      <td className="notes-table__action">
        <button onClick={handleDelete} style={{ verticalAlign: 'middle' }}>
          <TrashIcon style={{ width: '1.5rem' }} />
        </button>
      </td>
    </tr>
  );
});

export const NotesPage = () => {
  const notesService = useNoteBlocksService();
  const loadingDoneSubject = useContext(LoadingDoneSubjectContext);

  const input$ = useObservable(() => notesService.getAllNotesTuples$());

  const observedNotes = useObservableState(input$);

  useEffect(() => {
    if (Array.isArray(observedNotes)) {
      loadingDoneSubject.next();
    }
  }, [loadingDoneSubject, observedNotes]);

  return (
    <div className="notes-table">
      <table className="notes-table__table">
        <thead>
          <tr>
            <th className="notes-table__title-head">Title</th>
            <th className="notes-table__time-head">Created At</th>
            <th className="notes-table__action-head" />
          </tr>
        </thead>
        <tbody>
          {(observedNotes || [])
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((note) => (
              <NoteRow note={note} key={note.id} />
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default NotesPage;
