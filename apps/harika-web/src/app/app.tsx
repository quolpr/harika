import { Database } from '@nozbe/watermelondb';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import React, { useMemo, useState } from 'react';
import { TableName } from '../model/schema';
import NoteModel from '../model/Note';

import './app.css';
import { Header } from './components/Header/Header';
import { Note } from './components/Note/Note';
import {
  CurrentEditContext,
  ICurrentEditState,
} from './components/CurrentEditContent';

export function App({ notes }: { notes: NoteModel[] }) {
  const stateActions = useState<ICurrentEditState>();

  return (
    <CurrentEditContext.Provider value={stateActions}>
      <Header />
      <section className="main note-list">
        {notes.map((note) => (
          <Note key={note.id} note={note} />
        ))}
      </section>
    </CurrentEditContext.Provider>
  );
}

export default withDatabase(
  withObservables([], ({ database }: { database: Database }) => ({
    notes: database.collections.get(TableName.NOTES).query().observe(),
  }))(App as any)
);
