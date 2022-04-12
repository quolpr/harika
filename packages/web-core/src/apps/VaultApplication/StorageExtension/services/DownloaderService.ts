import axios from 'axios';
import { inject, injectable } from 'inversify';
import { merge } from 'lodash-es';
import {
  delay,
  exhaustMap,
  filter,
  interval,
  Observable,
  of,
  takeUntil,
} from 'rxjs';

import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { STOP_SIGNAL } from '../../../../framework/types';
import {
  AttachmentsRepository,
  attachmentsTable,
} from '../repositories/AttachmentsRepository';
import { UploadsDB } from '../UploadsDb';

@injectable()
export class DownloaderService {
  constructor(
    @inject(UploadsDB) private uploadsDb: UploadsDB,
    @inject(AttachmentsRepository)
    private fileUploadsRepo: AttachmentsRepository,
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(STOP_SIGNAL)
    private stop$: Observable<unknown>,
  ) {}

  start() {
    return merge(
      this.dbEventsService
        .changesChannel$()
        .pipe(
          filter(
            (chs) =>
              chs.filter((ch) => ch.collectionName === attachmentsTable)
                .length > 0,
          ),
        ),
      interval(5000),
    )
      .pipe(
        exhaustMap(() => this.performDownloads()),
        takeUntil(this.stop$),
      )
      .subscribe();
  }

  async performDownloads() {
    try {
      const notDownloadedUploads =
        await this.fileUploadsRepo.getNotDownloadedUploads();

      for (const upload of notDownloadedUploads) {
        if (!upload.url) continue;

        const response = await axios({
          url: upload.url,
          method: 'GET',
          responseType: 'blob',
        });

        await this.uploadsDb.uploads.put({
          id: upload.id,
          file: response.data,
        });

        await this.fileUploadsRepo.update(
          { ...upload, isDownloaded: true },
          {
            shouldRecordChange: true,
            source: 'inDbChanges',
          },
        );
      }
    } catch (e) {
      console.error('Failed to download upload', e);
    }
  }
}
