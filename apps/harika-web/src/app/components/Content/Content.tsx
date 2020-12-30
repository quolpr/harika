import React, { useEffect } from 'react';
import { NoteModel } from '@harika/harika-core';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useCurrentNote, useCurrentVault } from '@harika/harika-utils';
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
  const vault = useCurrentVault();

  useEffect(() => {
    const callback = async () => {
      await vault.preloadAllNotes();
    };

    callback();
  });

  return (
    <div>
      <ul className="list-disc fixed left-0 mt-10 ml-10 pl-8 pr-4 py-3 bg-green-300 rounded">
        {vault.allNotes.map((note) => (
          <li key={note.$modelId}>
            <TitleLink note={note} />
          </li>
        ))}
      </ul>
    </div>
  );
});
