import axios from 'axios';
import { inject, injectable } from 'inversify';
import {
  buffer,
  catchError,
  concatMap,
  debounceTime,
  EMPTY,
  exhaustMap,
  filter,
  interval,
  map,
  Observable,
  of,
  takeUntil,
} from 'rxjs';

import {
  IModelChange,
  ModelChangeType,
} from '../../../../extensions/SyncExtension/mobx-keystone/trackChanges';
import {
  ISyncConfig,
  MODELS_CHANGES_PIPE,
  SYNC_CONFIG,
} from '../../../../extensions/SyncExtension/types';
import { STOP_SIGNAL } from '../../../../framework/types';
import { BaseBlock } from '../../BlocksExtension/models/BaseBlock';
import { AttachmentsRepository } from '../repositories/AttachmentsRepository';
import { UploadsDB } from '../UploadsDb';

@injectable()
export class DeleteAttachmentsService {
  constructor(
    @inject(AttachmentsRepository)
    private attachmentsRepo: AttachmentsRepository,
    @inject(SYNC_CONFIG)
    private syncConfig: ISyncConfig,
    @inject(MODELS_CHANGES_PIPE)
    pipe$: Observable<IModelChange>,
    @inject(UploadsDB) private uploadsDb: UploadsDB,
    @inject(STOP_SIGNAL)
    stop$: Observable<void>,
  ) {
    const blocksChanges$ = pipe$.pipe(
      filter(
        (ch) =>
          ch.model instanceof BaseBlock && ch.type === ModelChangeType.Delete,
      ),
      map((ch) => ch.model),
    ) as Observable<BaseBlock>;

    blocksChanges$
      .pipe(
        concatMap((models) =>
          of(models).pipe(
            buffer(blocksChanges$.pipe(debounceTime(100))),
            concatMap(async (models) => {
              await this.markAsShouldBeDeleted(models.map(({ id }) => id));
            }),
            catchError(() => {
              return EMPTY;
            }),
          ),
        ),
        takeUntil(stop$),
      )
      .subscribe();

    // interval(10_000)
    //   .pipe(
    //     exhaustMap(async () =>
    //       this.removeAttachments(
    //         (await this.attachmentsRepo.getAttachmentsToDelete()).map(
    //           ({ id }) => id,
    //         ),
    //       ),
    //     ),
    //     catchError((err: unknown, o) => {
    //       console.error('Error happened', err);
    //       return o;
    //     }),
    //     takeUntil(stop$),
    //   )
    //   .subscribe();
  }

  private async markAsShouldBeDeleted(blockIds: string[]) {
    const ctx = {
      shouldRecordChange: true,
      source: 'inDbChanges' as const,
    };

    await this.attachmentsRepo.bulkUpdate(
      (
        await this.attachmentsRepo.getAttachmentsOfBlocks(blockIds)
      ).map((a) => ({ ...a, shouldBeDeleted: true })),
      ctx,
    );
  }

  // private async removeAttachments(ids: string[]) {
  //   if (ids.length === 0) return;

  //   const ctx = {
  //     shouldRecordChange: true,
  //     source: 'inDbChanges' as const,
  //   };
  //   await axios.delete(`${this.syncConfig.apiUrl}/upload`, {
  //     data: { ids },
  //     withCredentials: true,
  //   });

  //   await this.attachmentsRepo.bulkDelete(ids, ctx);
  //   await this.uploadsDb.uploads.bulkDelete(ids);
  // }
}
