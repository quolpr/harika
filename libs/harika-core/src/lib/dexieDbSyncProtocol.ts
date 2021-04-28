import Dexie from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';
import { IDatabaseChange } from 'dexie-observable/api';
import io from 'socket.io-client';
import { v4 } from 'uuid';

// Constants:
const RECONNECT_DELAY = 5000; // Reconnect delay in case of errors such as network down.

Dexie.Syncable.registerSyncProtocol('websocket', {
  sync: async (
    context,
    url,
    options: { scopeId: string },
    baseRevision,
    syncedRevision,
    changes,
    partial,
    applyRemoteChanges,
    onChangesAccepted,
    onSuccess,
    onError
  ) => {
    console.log('start sync');
    if (!context.identity) {
      context.identity = v4();
      await context.save();
    }

    const socket = io(url);
    let isFirstRound = true;

    const requestCallbacks: Record<string, () => void> = {};
    console.log({ changes, baseRevision, partial, url });

    function sendChanges(
      sChangesToSend: IDatabaseChange[],
      sBaseRevision: number,
      sPartial: boolean,
      sOnChangesAccepted: () => void
    ) {
      const requestId = v4();
      requestCallbacks[requestId.toString()] = sOnChangesAccepted;

      console.log('sending changes', { requestId, requestCallbacks });

      socket.emit('applyNewChanges', {
        changes: sChangesToSend,
        partial: sPartial,
        baseRevision: sBaseRevision,
        requestId: requestId,
      });
    }

    socket.on('connect', async () => {
      // handle the event sent with socket.send()
      socket.on(
        'requestHandled',
        ({
          requestId,
          status,
        }: {
          requestId: string;
          status: 'ok' | 'error';
        }) => {
          console.log('request handled', { requestId, status });
          if (requestCallbacks[requestId] && status !== 'error') {
            requestCallbacks[requestId]();

            delete requestCallbacks[requestId];
          }
        }
      );

      socket.on(
        'applyNewChanges',
        ({
          currentRevision,
          partial,
          changes,
        }: {
          currentRevision: number;
          partial: boolean;
          changes: IDatabaseChange[];
        }) => {
          console.log('new changes!!!', { currentRevision, partial, changes });
          applyRemoteChanges(changes, currentRevision, partial);

          if (isFirstRound && !partial) {
            isFirstRound = false;
            console.log('firstRound!', onSuccess);
            // Since this is the first sync round and server sais we've got all changes - now is the time to call onsuccess()
            onSuccess({
              // Specify a react function that will react on additional client changes
              react: (changes, baseRevision, partial, onChangesAccepted) => {
                console.log('new changes to send!', {
                  changes,
                  baseRevision,
                  partial,
                });
                sendChanges(changes, baseRevision, partial, onChangesAccepted);
              },
              // Specify a disconnect function that will close our socket so that we dont continue to monitor changes.
              disconnect: function () {
                socket.close();
              },
            });
          }
        }
      );

      socket.emit('initialize', {
        identity: context.identity,
        scopeId: options.scopeId,
        requestId: v4(),
      });

      if (changes.length !== 0) {
        await new Promise((resolve) => {
          sendChanges(changes, baseRevision, partial, () => {
            onChangesAccepted();
            resolve();
          });
        });
      }

      socket.emit('subscribeToChanges', { syncedRevision, requestId: v4() });
    });
  },
});
