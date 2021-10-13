import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useObservableEagerState } from 'observable-hooks';
import { bem } from '../../utils';
import './styles.css';
import 'tippy.js/dist/tippy.css';
import Tippy from '@tippyjs/react';
import {
  useIsConnectionAllowed$,
  useSyncState$,
  useVaultService,
} from '../../hooks/vaultAppHooks';
import { BehaviorSubject } from 'rxjs';
import { useMountedState } from 'react-use';

const syncStateClass = bem('syncState');

export const SyncState = () => {
  const isMounted = useMountedState();

  const syncState$ = useSyncState$();
  const isConnectionAllowed$ = useIsConnectionAllowed$();

  const syncState = useObservableEagerState(syncState$);
  const isConnectionAllowed = useObservableEagerState(isConnectionAllowed$);

  const isDbHealthOk = useObservableEagerState(
    useMemo(() => new BehaviorSubject(true), []),
  );

  const [isSyncing, setIsSyncing] = useState(syncState.isSyncing);

  const syncStateRef = useRef(syncState);

  useEffect(() => {
    if (syncState.isSyncing) {
      setIsSyncing(true);

      setTimeout(() => {
        if (!syncStateRef.current.isSyncing && isMounted()) {
          setIsSyncing(false);
        }
      }, 1500);
    }
  }, [syncState.isSyncing, isMounted]);

  const isSynced = syncState.isConnectedAndReadyToUse && !isSyncing;

  return (
    <div>
      <Tippy
        touch="hold"
        interactive
        delay={[0, 200]}
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
            DB health is{' '}
            <b>
              {isDbHealthOk ? (
                <span style={{ color: 'green' }}>ok</span>
              ) : (
                <span style={{ color: 'red' }}>bad</span>
              )}
            </b>
            .
            <br />
            This tab is{' '}
            <b>{syncState.isLeader ? 'a leader' : 'not a leader'}</b>.
            <br />
            <br />
            <b>{syncState.pendingClientChangesCount}</b> pending client changes.
            <br />
            <b>{syncState.pendingServerChangesCount}</b> pending server changes.
            <br />
            <br />
            <label>
              <input
                type="checkbox"
                checked={isConnectionAllowed}
                onChange={() => {
                  isConnectionAllowed$.next(!isConnectionAllowed);
                }}
              />
              <span style={{ marginLeft: 4, marginBottom: 2 }}>
                Sync server connection allowed
              </span>
            </label>
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
