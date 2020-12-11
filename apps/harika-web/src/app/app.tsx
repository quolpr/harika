import React, { useEffect, useState } from 'react';
import './app.css';
import { Header } from './components/Header/Header';
import {
  CurrentEditContext,
  ICurrentEditState,
} from './contexts/CurrentEditContent';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import {
  CurrentNoteIdContext,
  ICurrentNoteIdState,
} from './contexts/CurrentNoteIdContext';
import { usePrevious } from 'react-use';
import { useContext } from 'use-context-selector';
import { HarikaNotesTableName } from '@harika/harika-notes';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Content } from './components/Content/Content';
import { HarikaDatabase, initDb } from './initDb';
import { Provider } from 'rxdb-hooks';

const HandleNoteBlockBlur: React.FC = () => {
  const database = useDatabase();
  const [editState] = useContext(CurrentEditContext);

  const prevId = usePrevious(editState?.id);

  useEffect(() => {
    (async () => {
      if (!prevId) return;

      if (editState?.id !== prevId) {
        const noteBlock = await database.collections
          .get<NoteBlockModel>(HarikaNotesTableName.NOTE_BLOCKS)
          .find(prevId);

        await noteBlock.createNotesAndRefsIfNeeded();

        console.log('notes and refs are created!');
      }
    })();
  });

  return null;
};

export function App() {
  const stateActions = useState<ICurrentEditState>();
  const currentNoteIdActions = useState<ICurrentNoteIdState>();

  const [db, setDb] = useState<HarikaDatabase | undefined>();

  useEffect(() => {
    const callback = async () => {
      const _db = await initDb();
      setDb(_db);
    };
    callback();
  }, []);

  return (
    <BrowserRouter>
      <Provider db={db}>
        <CurrentNoteIdContext.Provider value={currentNoteIdActions}>
          <CurrentEditContext.Provider value={stateActions}>
            <Header />
            <Content />
            <section className="main">
              <Switch>
                <Route exact path="/">
                  <MainPageRedirect />
                </Route>
                <Route path="/notes/:id">
                  <NotePage />
                </Route>
              </Switch>
            </section>
          </CurrentEditContext.Provider>
        </CurrentNoteIdContext.Provider>
      </Provider>
    </BrowserRouter>
  );
}
