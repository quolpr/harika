import React, { useState } from 'react';
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

export function App() {
  const stateActions = useState<ICurrentEditState>();
  const currentNoteIdActions = useState<ICurrentNoteIdState>();

  return (
    <BrowserRouter>
      <CurrentNoteIdContext.Provider value={currentNoteIdActions}>
        <CurrentEditContext.Provider value={stateActions}>
          <Header />
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
    </BrowserRouter>
  );
}
