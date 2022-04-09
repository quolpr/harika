import Dexie from 'dexie';

interface IUpload {
  id: string;
  file: Blob;
}

export class UploadsDB extends Dexie {
  uploads!: Dexie.Table<IUpload, string>;

  constructor() {
    super('uploadsDb');
    this.version(1).stores({
      uploads: '&id',
    });
  }
}
