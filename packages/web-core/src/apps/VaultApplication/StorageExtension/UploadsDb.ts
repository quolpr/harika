import Dexie from 'dexie';

interface IUpload {
  id: string;
  file: Blob;
}

interface IToDeleteUpload {
  id: string;
}

export class UploadsDB extends Dexie {
  uploads!: Dexie.Table<IUpload, string>;
  deleteQueue!: Dexie.Table<IToDeleteUpload, string>;

  constructor(applicationId: string) {
    super(`uploads-db-${applicationId}`);

    this.version(1).stores({
      uploads: '&id',
    });

    this.version(2).stores({
      uploads: '&id',
      deleteQueue: '&id',
    });
  }
}
