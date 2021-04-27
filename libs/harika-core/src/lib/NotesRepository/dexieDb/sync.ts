import Dexie from 'dexie';
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
    if (!context.identity) {
      context.identity = v4();
      await context.save();
    }

    const socket = io(url);
    let isFirstRound = true;

    const requestCallbacks: Record<string, () => void> = {};

    function sendChanges(
      changesToSend: IDatabaseChange[],
      baseRevision: number,
      partial: boolean,
      onChangesAccepted: () => void
    ) {
      const requestId = v4();
      requestCallbacks[requestId.toString()] = onChangesAccepted;

      // In this example, the server expects the following JSON format of the request:
      //  {
      //      type: "changes"
      //      baseRevision: baseRevision,
      //      changes: changes,
      //      partial: partial,
      //      requestId: id
      //  }
      //  To make the sample simplified, we assume the server has the exact same specification of how changes are structured.
      //  In real world, you would have to pre-process the changes array to fit the server specification.
      //  However, this example shows how to deal with the WebSocket to fullfill the API.

      socket.emit('applyNewChanges', {
        changes: changesToSend,
        partial: partial,
        baseRevision: baseRevision,
        requestId: requestId,
      });
    }

    socket.on('connect', () => {
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
          applyRemoteChanges(changes, currentRevision, partial);

          if (isFirstRound && !partial) {
            // Since this is the first sync round and server sais we've got all changes - now is the time to call onsuccess()
            onSuccess({
              // Specify a react function that will react on additional client changes
              react: (changes, baseRevision, partial, onChangesAccepted) => {
                sendChanges(changes, baseRevision, partial, onChangesAccepted);
              },
              // Specify a disconnect function that will close our socket so that we dont continue to monitor changes.
              disconnect: function () {
                socket.close();
              },
            });
            isFirstRound = false;
          }
        }
      );

      socket.emit('initialize', {
        identity: context.identity,
        scopeId: options.scopeId,
        requestId: v4(),
      });

      // TODO: await
      sendChanges(changes, baseRevision, partial, onChangesAccepted);

      socket.emit('subscribeToChanges', { syncedRevision, requestId: v4() });
    });
  },
});
