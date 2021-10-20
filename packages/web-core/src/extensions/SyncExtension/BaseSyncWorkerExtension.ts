import { Class } from 'utility-types';
import { BaseWorkerExtension } from '../../framework/BaseWorkerExtension';
import { IMigration } from '../DbExtension/types';
import { REPOS_WITH_SYNC } from './types';
import { BaseSyncRepository } from './worker/BaseSyncRepository';

export abstract class BaseSyncWorkerExtension extends BaseWorkerExtension {
  async register() {
    this.repos().forEach((config) => {
      this.container.bind(config.repo).toSelf();

      if (config.withSync) {
        this.container
          .bind(REPOS_WITH_SYNC)
          .toDynamicValue(() => this.container.get(config.repo));
      }

      if (config.remote) {
        this.bindRemote(config.repo);
      }
    });
  }

  protected abstract migrations(): IMigration[];
  protected abstract repos(): {
    repo: Class<BaseSyncRepository>;
    withSync: boolean;
    remote: boolean;
  }[];
}
