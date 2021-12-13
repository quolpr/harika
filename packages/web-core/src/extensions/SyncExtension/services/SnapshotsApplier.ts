import { concatMap, exhaustMap, interval, Observable } from 'rxjs';
import { SyncRepository } from '../repositories/SyncRepository';

export class SnapshotsApplier {
  constructor(private syncRepo: SyncRepository) {}

  start() {
    new Observable((obs) => {
      return this.syncRepo.onNewSnapshots(() => {
        obs.next();
      });
    }).pipe(
      concatMap(async () => {
        await this.syncRepo.getSnapshotsPulls();
      }),
    );
  }
}
