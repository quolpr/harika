import React, { useEffect, useState } from 'react';
import { HarikaNotesTableName, NoteModel } from '@harika/harika-notes';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useCurrentNote, useHarikaStore } from '@harika/harika-core';
import { observer } from 'mobx-react-lite';

const TitleLink = observer(({ note }: { note: NoteModel }) => {
  const currentNote = useCurrentNote();

  return (
    <Link
      to={`/notes/${note.$modelId}`}
      className={clsx('flex', { 'font-bold': currentNote === note })}
    >
      <div className="mr-5">{note.title}</div>
      <div className="ml-auto">
        (c: {note.areChildrenLoaded.toString()}, l:{' '}
        {note.areLinksLoaded.toString()})
      </div>
    </Link>
  );
});

export const Content = observer(() => {
  const store = useHarikaStore();

  useEffect(() => {
    const callback = async () => {
      await store.preloadAllNotes();
    };

    callback();
  });

  return (
    <div>
      <ul className="list-disc fixed left-0 mt-10 ml-10 pl-8 pr-4 py-3 bg-green-300 rounded">
        {store.getAllNotes().map((note) => (
          <li key={note.$modelId}>
            <TitleLink note={note} />
          </li>
        ))}
      </ul>
    </div>
  );
});
