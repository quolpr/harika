import 'tippy.js/dist/tippy.css';

import Tippy from '@tippyjs/react';
import { useObservableEagerState } from 'observable-hooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMountedState } from 'react-use';
import { BehaviorSubject } from 'rxjs';
import { keyframes } from 'styled-components';
import { css, styled } from 'twin.macro';

import {
  useIsConnectionAllowed$,
  useSyncState$,
} from '../../hooks/vaultAppHooks';
import { bem } from '../../utils';

const syncStateClass = bem('syncState');

const SyncStateStyled = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  width: 30px;
  height: 30px;
`;

const Info = styled.div`
  font-size: 1rem;
  padding: 5px;
  min-width: 300px;
`;

const pulseYellow = keyframes`
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 177, 66, 0.7);
  }

  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(255, 177, 66, 0);
  }

  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 177, 66, 0);
  }

`;

const Dot = styled.div<{ isSyncing: boolean; isSynced: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 82, 82, 1);

  margin-top: 1px;

  ${({ isSyncing }) =>
    isSyncing &&
    css`
      background: rgba(255, 177, 66, 1);
      box-shadow: 0 0 0 0 rgba(255, 177, 66, 1);
      animation: ${pulseYellow} 0.8s infinite;
    `}

  ${({ isSynced }) =>
    isSynced &&
    css`
      background: green;
    `}
`;

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
          <Info className={syncStateClass('info')}>
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
            <b>{syncState.pendingServerSnapshotsCount}</b> pending server
            snapshots.
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
          </Info>
        }
      >
        <SyncStateStyled className={syncStateClass()}>
          <Dot
            className={syncStateClass('dot', {
              isSyncing: isSyncing,
              isSynced: syncState.isConnectedAndReadyToUse && !isSyncing,
            })}
            isSyncing={isSyncing}
            isSynced={syncState.isConnectedAndReadyToUse && !isSyncing}
          ></Dot>
        </SyncStateStyled>
      </Tippy>
    </div>
  );
};
