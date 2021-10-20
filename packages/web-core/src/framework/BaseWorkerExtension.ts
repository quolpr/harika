import { Class } from 'utility-types';
import { BaseExtension } from './BaseExtension';
import { toRemoteName } from './utils';

export abstract class BaseWorkerExtension extends BaseExtension {
  protected async bindRemote(klass: Class<any>) {
    this.container
      .bind(toRemoteName(klass))
      .toDynamicValue(() => this.container.get(klass));
  }
}
