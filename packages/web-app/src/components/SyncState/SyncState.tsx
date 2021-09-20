import React, { useEffect, useRef, useState } from 'react';
import { useObservableEagerState } from 'observable-hooks';
import { useNotesService } from '../../contexts/CurrentNotesServiceContext';
import { bem } from '../../utils';
import './styles.css';
import 'tippy.js/dist/tippy.css';
import Tippy from '@tippyjs/react';

const syncStateClass = bem('syncState');

export const SyncState = () => {
  const noteService = useNotesService();

  const syncState = useObservableEagerState(noteService.syncState$);

  const [isSyncing, setIsSyncing] = useState(syncState.isSyncing);

  const syncStateRef = useRef(syncState);

  useEffect(() => {
    if (syncState.isSyncing) {
      setIsSyncing(true);

      setTimeout(() => {
        if (!syncStateRef.current.isSyncing) {
          setIsSyncing(false);
        }
      }, 1500);
    }
  }, [syncState.isSyncing]);

  const isSynced = syncState.isConnectedAndReadyToUse && !isSyncing;

  return (
    <div>
      <Tippy
        touch="hold"
        interactive
        content={
          <div className={syncStateClass('info')}>
            {isSynced
              ? 'Harika is synced!'
              : isSyncing
              ? 'Harika is syncing!'
              : 'Harika is not synced.'}
            <br />
            <br />
            Harika is{' '}
            <b>
              {syncState.isConnectedAndReadyToUse ? (
                <span style={{ color: 'green' }}>online</span>
              ) : (
                <span style={{ color: 'red' }}>offline</span>
              )}
            </b>
            .
            <br />
            {syncState.isConnected ? (
              <span style={{ color: 'green' }}>Connected</span>
            ) : (
              <span style={{ color: 'red' }}>Not connected</span>
            )}{' '}
            to the server.
            <br />
            {syncState.isConnectedAndReadyToUse ? (
              <span style={{ color: 'green' }}>Connected</span>
            ) : (
              <span style={{ color: 'red' }}>Not connected</span>
            )}{' '}
            to the sync channel.
            <br />
            This tab is{' '}
            <b>{syncState.isLeader ? 'a leader' : 'not a leader'}</b>.
            <br />
            <br />
            <b>{syncState.pendingClientChangesCount}</b> pending client changes.
            <br />
            <b>{syncState.pendingServerChangesCount}</b> pending server changes.
          </div>
        }
      >
        <div className={syncStateClass()}>
          <div
            className={syncStateClass('dot', {
              isSyncing: isSyncing,
              isSynced: syncState.isConnectedAndReadyToUse && !isSyncing,
            })}
          ></div>
        </div>
      </Tippy>
    </div>
  );
};
