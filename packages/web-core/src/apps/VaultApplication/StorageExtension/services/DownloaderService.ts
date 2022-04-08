import axios from 'axios';
import { injectable, inject } from 'inversify';
import { merge } from 'lodash-es';
import { interval, exhaustMap, takeUntil, Observable } from 'rxjs';
import { STOP_SIGNAL } from '../../../../framework/types';
import { FileUploadsRepository } from '../repositories/FileUploadRepository';
import { UploadsDB } from '../UploadsDb';

@injectable()
export class DownloaderService {
  constructor(
    @inject(UploadsDB) private uploadsDb: UploadsDB,
    @inject(FileUploadsRepository)
    private fileUploadsRepo: FileUploadsRepository,
    @inject(STOP_SIGNAL)
    private stop$: Observable<unknown>,
  ) {}

  start() {
    return merge(interval(1000))
      .pipe(
        exhaustMap(() => this.performDownloads()),
        takeUntil(this.stop$),
      )
      .subscribe();
  }

  async performDownloads() {
    const notDownloadedUploads =
      await this.fileUploadsRepo.getNotDownloadedUploads();

    for (const upload of notDownloadedUploads) {
      if (!upload.url) continue;

      try {
        const response = await axios({
          url: upload.url,
          method: 'GET',
          responseType: 'blob',
        });

        await this.uploadsDb.uploads.put({
          id: upload.id,
          file: response.data,
        });

        this.fileUploadsRepo.update(
          { ...upload, isDownloaded: true },
          {
            shouldRecordChange: true,
            source: 'inDbChanges',
          },
        );
      } catch (e) {
        console.error('Failed to download upload', e);
      }
    }
  }
}
