import { TrashIcon } from '@heroicons/react/solid';
import { observer } from 'mobx-react-lite';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useCallback, useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import tw, { styled } from 'twin.macro';

import { LoadingDoneSubjectContext } from '../../contexts';
import { useNotePath } from '../../contexts/StackedNotesContext';
import {
  useDeleteBlocksService,
  useNoteBlocksService,
} from '../../hooks/vaultAppHooks';
import { bem } from '../../utils';

type NoteTuple = {
  id: string;
  title: string;
  createdAt: Date;
};

const notesTableClass = bem('notes-table');

const NotesTableWrapper = styled.div`
  ${tw`pt-5 pb-5`}
  width: 100%;
`;

const NotesTable = styled.table`
  table-layout: fixed;
  width: 100%;

  tbody {
    ${tw`pt-2`}
  }

  tr {
    ${tw`border-b border-gray-700`}
  }

  td {
    ${tw`py-3`}

    svg {
      ${tw`text-pink-600`}

      margin: 0 auto;
      cursor: pointer;
    }
  }
`;

const TitleHead = styled.th`
  ${tw`w-1/2 pb-2 text-left`}
`;

const TimeHead = styled.th`
  ${tw`w-1/4 pb-2`}
`;

const ActionHead = styled.th`
  ${tw`w-12`}
`;

const CenterText = styled.td`
  text-align: center;
`;

const NoteRow = observer(({ note }: { note: NoteTuple }) => {
  const deleteBlocksService = useDeleteBlocksService();

  const handleDelete = useCallback(() => {
    void deleteBlocksService.deleteBlock(note.id);
  }, [deleteBlocksService, note.id]);

  const notePath = useNotePath();

  return (
    <tr>
      <td className="pl-1">
        <Link to={notePath(note.id)}>{note.title}</Link>
      </td>
      <CenterText className={notesTableClass('time')}>
        <TimeAgo date={note.createdAt} />
      </CenterText>
      <CenterText className={notesTableClass('action')}>
        <button onClick={handleDelete} style={{ verticalAlign: 'middle' }}>
          <TrashIcon style={{ width: '1.5rem' }} />
        </button>
      </CenterText>
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
    <NotesTableWrapper className={notesTableClass()}>
      <NotesTable className={notesTableClass('table')}>
        <thead>
          <tr>
            <TitleHead className={notesTableClass('title-head')}>
              Title
            </TitleHead>
            <TimeHead className={notesTableClass('time-head')}>
              Created At
            </TimeHead>
            <ActionHead className={notesTableClass('actions-head')} />
          </tr>
        </thead>
        <tbody>
          {(observedNotes || [])
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((note) => (
              <NoteRow note={note} key={note.id} />
            ))}
        </tbody>
      </NotesTable>
    </NotesTableWrapper>
  );
};

export default NotesPage;
