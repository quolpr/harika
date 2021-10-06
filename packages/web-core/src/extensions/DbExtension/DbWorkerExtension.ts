import { BaseExtension } from '../../framework/BaseExtension';
import { bindDbName } from './bindDbName';
import { DB } from './DB';
import { DB_MIGRATIONS } from './types';

export default class DbWorkerExtension extends BaseExtension {
  async register() {
    bindDbName(this.container);

    this.container.bind(DB).toSelf();
  }

  async initialize() {
    await this.container.get(DB).init(this.container.getAll(DB_MIGRATIONS));
  }
}
