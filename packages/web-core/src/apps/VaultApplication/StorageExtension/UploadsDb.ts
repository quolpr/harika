import Dexie from 'dexie';

interface IUpload {
  id: string;
  file: Blob;
}

export class UploadsDB extends Dexie {
  uploads!: Dexie.Table<IUpload, string>;

  constructor(applicationId: string) {
    super(`uploads-db-${applicationId}`);

    this.version(3).stores({
      uploads: '&id',
    });
  }
}
