import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { Subject, Observable, merge, interval } from 'rxjs';
import { auditTime, concatMap, find, share } from 'rxjs/operators';
import { Queries } from './db/Queries';
import { Vault } from './Vault';
import { v4 as uuidv4 } from 'uuid';

export class Syncher {
  private syncSubject: Subject<void | { id: string }>;
  private syncPipe: Observable<void | number | { id: string }>;

  constructor(
    private database: Database,
    private vault: Vault,
    private queries: Queries
  ) {
    this.syncSubject = new Subject();

    this.syncPipe = merge(this.syncSubject, interval(5000))
      .pipe(auditTime(1000))
      .pipe(
        concatMap(async (data) => {
          await this.performSync();
          return data;
        })
      )
      .pipe(share());

    this.syncPipe.subscribe();
  }

  async sync() {
    const id = uuidv4();
    const promise = this.syncPipe
      .pipe(find((ev) => typeof ev === 'object' && 'id' in ev && ev.id === id))
      .toPromise();

    this.syncSubject.next({ id });

    await promise;
  }

  private async performSync() {
    let latestVersionOfSession = 0;
    let changesOfSession: any = {};
    let wasPushPresent = false;

    console.log('sync! - step 1');

    await synchronize({
      database: this.database,
      pullChanges: async ({ lastPulledAt }) => {
        const response = await fetch(
          `http://192.168.1.127:5000/api/sync/pull?lastPulledVersion=${
            lastPulledAt || 0
          }`
        );
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const { changes, latestVersion } = await response.json();

        console.log({ pull: changes });

        latestVersionOfSession = latestVersion;
        changesOfSession = changes;

        return { changes, timestamp: latestVersion || 1 };
      },
      pushChanges: async ({ changes, lastPulledAt }) => {
        wasPushPresent = true;

        const response = await fetch(
          `http://192.168.1.127:5000/api/sync/push?lastPulledVersion=${
            lastPulledAt || 0
          }`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(changes),
          }
        );

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const {
          changes: changesFromPush,
          latestVersion,
        } = await response.json();
        console.log({ push: changes });

        latestVersionOfSession = latestVersion;
        changesOfSession = changesFromPush;
      },
    });

    if (wasPushPresent) {
      console.log('sync! - step 2');
      try {
        await synchronize({
          database: this.database,
          pullChanges: async ({ lastPulledAt }) => {
            console.log({ pull: changesOfSession });

            return {
              changes: changesOfSession,
              timestamp: latestVersionOfSession,
            };
          },
          pushChanges: async ({ changes, lastPulledAt }) => {
            throw 'Push changes';
          },
        });
      } catch (e) {
        console.error('Error step 2!', e);
        // The error coulde raised on push, and it is ok
      }
    }

    const noteBlocksChanges = changesOfSession.note_blocks;

    const noteBlockIdsToSelect = [
      ...noteBlocksChanges.created.map(({ id }) => id),
      ...noteBlocksChanges.updated.map(({ id }) => id),
    ];

    const notesChanges = changesOfSession.notes;

    const noteIdsToSelect = [
      ...notesChanges.created.map(({ id }) => id),
      ...notesChanges.updated.map(({ id }) => id),
    ];

    console.log({ noteBlockIdsToSelect, noteIdsToSelect });

    await Promise.all(
      noteBlockIdsToSelect.map(async (noteBlockId) => {
        const noteBlock = await this.queries.getNoteBlockRowById(noteBlockId);

        if (this.vault.notesMap[noteBlock.noteId]) {
          if (noteIdsToSelect.indexOf(noteBlock.id) !== -1) {
            noteIdsToSelect.splice(
              noteIdsToSelect.indexOf(noteBlock.noteId),
              1
            );
          }

          await this.vault.preloadNote(noteBlock.noteId);
        }
      })
    );

    await Promise.all(
      noteIdsToSelect.map(async (noteId) => {
        console.log('syncing', noteId);
        await this.vault.preloadNote(noteId, true, true);
      })
    );
  }
}
