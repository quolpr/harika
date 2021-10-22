import { Class } from 'utility-types';
import { BaseExtension } from '../../framework/BaseExtension';
import { IMigration } from '../DbExtension/types';
import { REPOS_WITH_SYNC } from './types';
import { BaseSyncRepository } from './worker/BaseSyncRepository';

export abstract class BaseSyncExtension extends BaseExtension {
  async register() {
    this.repos().forEach((config) => {
      this.container.bind(config.repo).toSelf();

      if (config.withSync) {
        this.container
          .bind(REPOS_WITH_SYNC)
          .toDynamicValue(() => this.container.get(config.repo));
      }
    });
  }

  protected abstract migrations(): IMigration[];
  protected abstract repos(): {
    repo: Class<BaseSyncRepository>;
    withSync: boolean;
  }[];
}
