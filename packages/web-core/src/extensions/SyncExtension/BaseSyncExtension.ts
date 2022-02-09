import { Class } from 'utility-types';

import { BaseExtension } from '../../framework/BaseExtension';
import { DB_MIGRATIONS, IMigration } from '../DbExtension/types';
import { BaseSyncRepository } from './BaseSyncRepository';
import { REPOS_WITH_SYNC } from './types';

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

    this.migrations().forEach((m) => {
      this.container.bind(DB_MIGRATIONS).toConstantValue(m);
    });
  }

  protected abstract migrations(): IMigration[];
  protected abstract repos(): {
    repo: Class<BaseSyncRepository>;
    withSync: boolean;
  }[];
}
