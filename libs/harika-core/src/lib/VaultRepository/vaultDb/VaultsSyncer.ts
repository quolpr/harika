import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { Channel, Socket } from 'phoenix';
import { merge, Observable, Subject } from 'rxjs';
import { auditTime, concatMap, map, share } from 'rxjs/operators';

// TODO make common syncher for noteRepository and vaultRepository
export class VaultsSyncer {
  private channel: Channel;
  syncSubject: Subject<void>;
  syncPipe: Observable<void>;

  constructor(private database: Database, socket: Socket, userId: string) {
    this.channel = socket.channel(`user-vaults:${userId}`);
    this.channel.join();

    const vaultsUpdated = new Observable<void>((observer) => {
      const ref = this.channel.on('vaults_updated', () => {
        observer.next();
      });

      return () => this.channel.off('vaults_updated', ref);
    });

    this.syncSubject = new Subject();
    this.syncPipe = merge(
      this.syncSubject,
      vaultsUpdated,
      this.database
        .withChangesForTables(Object.keys(this.database.schema.tables))
        .pipe(map((): void => undefined))
    )
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

  sync = () => {
    this.syncSubject.next();
  };

  private pushMessage = (event: string, payload: object) => {
    return new Promise<any>((resolve, reject) => {
      this.channel
        .push(event, payload)
        .receive('ok', (msg) => resolve(msg))
        .receive('error', (reasons) => reject(reasons));
      // .receive('timeout', () => reject('timeout'));
    });
  };

  private performSync = async () => {
    let latestVersionOfSession = 0;
    let changesOfSession: any = {};
    let wasPushPresent = false;

    console.log('sync! - step 1', this);

    await synchronize({
      database: this.database,
      pullChanges: async ({ lastPulledAt }) => {
        const { changes, latestVersion } = await this.pushMessage('pull', {
          last_pulled_version: lastPulledAt || 0,
        });

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
  };
}
