import './wdyr';
import React from 'react';
import './App.css';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { NotesPage } from './pages/NotesPage/NotesPage';
import Modal from 'react-modal';
import { VaultsPage } from './pages/VaultsPage';
import { VaultLayout } from './components/VaultLayout/VaultLayout';

Modal.setAppElement('body');

const vaultId = '123';

export function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/">
          <VaultLayout vaultId={vaultId}>
            <MainPageRedirect />
          </VaultLayout>
        </Route>
        <Route path="/notes/:id">
          <VaultLayout vaultId={vaultId}>
            <NotePage />
          </VaultLayout>
        </Route>
        <Route path="/notes">
          <VaultLayout vaultId={vaultId}>
            <NotesPage />
          </VaultLayout>
        </Route>
        <Route path="/vaults">
          <VaultsPage />
        </Route>
      </Switch>
    </BrowserRouter>
  );
}
