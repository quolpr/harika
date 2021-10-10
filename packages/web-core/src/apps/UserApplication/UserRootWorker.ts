import { RootWorker } from '../../framework/RootWorker';

export class UserRootWorker extends RootWorker {
  async getExtensions() {
    return (
      await Promise.all([
        import('../../extensions/DbExtension/DbWorkerExtension'),
        import('../../extensions/SyncExtension/SyncWorkerExtension'),
        import('./UserExtension/UserWorkerExtension'),
      ])
    ).map((res) => res.default);
  }
}
