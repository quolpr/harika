import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { Subject, Observable, merge } from 'rxjs';
import { auditTime, concatMap, find, share } from 'rxjs/operators';
import { Queries } from './db/Queries';
import { Vault } from './Vault';
import { v4 as uuidv4 } from 'uuid';
import { Channel, Socket } from 'phoenix';

const socket = new Socket('ws://localhost:5000/socket');

export class Syncher {
  private syncSubject: Subject<void | { id: string }>;
  private syncPipe: Observable<void | number | { id: string }>;
  private channel: Channel;

  constructor(
    private database: Database,
    private vault: Vault,
    private queries: Queries
  ) {
    socket.connect();
    this.channel = socket.channel(`vault:${vault.$modelId}`);
    this.channel.join();

    const vaultUpdated = new Observable<void>((observer) => {
      const ref = this.channel.on('vault_updated', () => {
        observer.next();
      });

      return () => this.channel.off('vault_updated', ref);
    });

    this.syncSubject = new Subject();
    this.syncPipe = merge(this.syncSubject, vaultUpdated)
      .pipe(auditTime(200))
      .pipe(
        concatMap(async (data) => {
          await this.performSync();
          return data;
        })
      )
      .pipe(share());

    this.syncPipe.subscribe();
  }

  // private pushMessage = (event: string, payload: object) => {
  //   return new Observable((observer) => {
  //     this.channel
  //       .push(event, payload)
  //       .receive('ok', (msg) => observer.next(msg))
  //       .receive('error', (reasons) => observer.error(reasons))
  //       .receive('timeout', () => observer.error('timeout'));
  //   });
  // };

  async sync() {
    const id = uuidv4();
    const promise = this.syncPipe
      .pipe(find((ev) => typeof ev === 'object' && 'id' in ev && ev.id === id))
      .toPromise();

    this.syncSubject.next({ id });

    await promise;
  }

  private pushMessage = (event: string, payload: object) => {
    return new Promise<any>((resolve, reject) => {
      this.channel
        .push(event, payload)
        .receive('ok', (msg) => resolve(msg))
        .receive('error', (reasons) => reject(reasons))
        .receive('timeout', () => reject('timeout'));
    });
  };

  private async performSync() {
    let latestVersionOfSession = 0;
    let changesOfSession: any = {};
    let wasPushPresent = false;

    console.log('sync! - step 1');

    await synchronize({
      database: this.database,
      pullChanges: async ({ lastPulledAt }) => {
        const { changes, latestVersion } = await this.pushMessage('pull', {
          last_pulled_version: lastPulledAt || 0,
        });

        console.log({ pull: changes });

        latestVersionOfSession = latestVersion;
        changesOfSession = changes;

        return { changes, timestamp: latestVersion || 1 };
      },
      pushChanges: async ({ changes, lastPulledAt }) => {
        wasPushPresent = true;

        console.log({ push: changes });
        const {
          changes: changesFromPush,
          latestVersion,
        } = await this.pushMessage('push', {
          last_pulled_version: lastPulledAt || 0,
          changes,
        });

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
