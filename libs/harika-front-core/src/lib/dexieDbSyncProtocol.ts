import Dexie from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';
import { IDatabaseChange } from 'dexie-observable/api';
import io from 'socket.io-client';
import { v4 } from 'uuid';
import { generateId } from './generateId';
import { RxSyncer } from './dexieHelpers/RxSyncer';

Dexie.Observable.createUUID = generateId;

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
    // TODO: handle onError
    onError
  ) => {
    console.log('start sync');
    if (!context.identity) {
      context.identity = v4();
      await context.save();
    }

    const socket = io(url, { transports: ['websocket'] });
    const rxSyncer = new RxSyncer(socket, options.scopeId, context.identity);

    let isFirstRound = true;

    rxSyncer.changesFromServer$.subscribe(
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
          isFirstRound = false;

          onSuccess({
            react: async (
              changes,
              baseRevision,
              partial,
              onChangesAccepted
            ) => {
              await rxSyncer
                .sendChanges$(changes, baseRevision, partial)
                .toPromise();

              onChangesAccepted();
            },
            disconnect: function () {
              socket.close();
            },
          });
        }
      }
    );

    socket.connect();

    await rxSyncer.initialize$().toPromise();

    if (changes.length !== 0) {
      await rxSyncer.sendChanges$(changes, baseRevision, partial).toPromise();
    }

    onChangesAccepted();
    console.log(' onChangesAccepted');

    rxSyncer.subscribeToServerChanges$(syncedRevision);
  },
});
