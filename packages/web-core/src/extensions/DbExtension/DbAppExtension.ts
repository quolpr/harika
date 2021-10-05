import { BaseExtension } from '../../framework/BaseExtension';
import { bindDbName } from './bindDbName';

export class DbAppExtension extends BaseExtension {
  async register() {
    bindDbName(this.container);
  }
}
