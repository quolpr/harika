import { BaseExtension } from '../../framework/BaseExtension';
import { bindDbName } from './bindDbName';
import { DB } from './DB';
import { MigrationRunner } from './MigrationRunner';

export class DbAppExtension extends BaseExtension {
  async register() {
    bindDbName(this.container);

    this.container.bind(DB).toSelf();
  }

  async initialize() {
    await this.container.get(DB).init();
    await this.container.resolve(MigrationRunner).run();
  }
}
