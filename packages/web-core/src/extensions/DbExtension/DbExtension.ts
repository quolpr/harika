import { BaseExtension } from '../../framework/BaseExtension';
import { APPLICATION_ID, APPLICATION_NAME } from '../../framework/types';
import { DB } from './DB';
import { DB_NAME, MIGRATIONS } from './types';

export default class DbExtension extends BaseExtension {
  async register() {
    this.container
      .bind(DB_NAME)
      .toConstantValue(
        `${this.container.get(APPLICATION_NAME)}_${this.container.get(
          APPLICATION_ID,
        )}`,
      );

    this.container.bind(DB).toSelf();
  }

  async initialize() {
    await this.container.get(DB).init(this.container.getAll(MIGRATIONS));
  }
}
