import Dexie from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';
import io from 'socket.io-client';
import { v4 } from 'uuid';
import { generateId } from './generateId';
import { RxSyncer } from './dexieHelpers/RxSyncer';
import { IDatabaseChange } from '@harika/harika-core';

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

    rxSyncer.initialize(
      changes as IDatabaseChange[],
      baseRevision,
      partial,
      onChangesAccepted,
      syncedRevision,
      applyRemoteChanges,
      onSuccess
    );
  },
});
