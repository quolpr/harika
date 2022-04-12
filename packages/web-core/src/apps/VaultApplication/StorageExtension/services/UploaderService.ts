import axios from 'axios';
import { inject, injectable } from 'inversify';
import { omit } from 'lodash-es';
import {
  concatMap,
  filter,
  interval,
  merge,
  Observable,
  takeUntil,
} from 'rxjs';

import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import {
  ISyncConfig,
  SYNC_CONFIG,
} from '../../../../extensions/SyncExtension/types';
import { STOP_SIGNAL } from '../../../../framework/types';
import {
  AttachmentsRepository,
  attachmentsTable,
  IAttachmentDoc,
} from '../repositories/AttachmentsRepository';
import { UploadsDB } from '../UploadsDb';

type IUploadWithFile = IAttachmentDoc & { file: Blob };

@injectable()
export class UploaderService {
  constructor(
    @inject(UploadsDB) private uploadsDb: UploadsDB,
    @inject(AttachmentsRepository)
    private fileUploadsRepo: AttachmentsRepository,
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(SYNC_CONFIG)
    private syncConfig: ISyncConfig,
    @inject(STOP_SIGNAL)
    private stop$: Observable<unknown>,
  ) {}

  start() {
    // TODO: add offline check
    merge(
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
        concatMap(() => this.performUploads()),
        takeUntil(this.stop$),
      )
      .subscribe();
  }

  private async performUploads() {
    try {
      const uploadsWithFile = await this.getUploadsWithFile();

      const syncCtx: ISyncCtx = {
        shouldRecordChange: true,
        source: 'inDbChanges',
      };

      for (const upload of uploadsWithFile) {
        const url = await this.performUpload(upload);

        await this.fileUploadsRepo.update(
          { ...omit(upload, 'file'), url, isUploaded: true },
          syncCtx,
        );
      }
    } catch (e) {
      console.error('Failed to upload', e);
    }
  }

  private async getUploadsWithFile(): Promise<IUploadWithFile[]> {
    const uploadDocs = await this.fileUploadsRepo.getNotUploadedUploads();
    const uploadDocsKeys = Object.fromEntries(uploadDocs.map((u) => [u.id, u]));

    return (await this.uploadsDb.uploads.bulkGet(uploadDocs.map((u) => u.id)))
      .flatMap((u) => (u ? u : []))
      .map((u) => ({ ...u, ...uploadDocsKeys[u.id] }));
  }

  private async performUpload(upload: IUploadWithFile) {
    const formData = new FormData();
    formData.append('fileId', upload.id);
    formData.append('file', upload.file);

    return (
      await axios.post<{ url: string }>(
        `${this.syncConfig.apiUrl}/upload`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      )
    ).data.url;
  }
}
