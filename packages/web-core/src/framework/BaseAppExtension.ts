import { Remote } from 'comlink';
import { Class } from 'utility-types';
import { BaseExtension } from './BaseExtension';
import { RootWorker } from './RootWorker';
import { ROOT_WORKER } from './types';
import { toRemoteName } from './utils';

export abstract class BaseAppExtension extends BaseExtension {
  protected async bindRemote(klass: Class<any>) {
    const rootWorker = this.container.get<Remote<RootWorker>>(ROOT_WORKER);

    this.container
      .bind(toRemoteName(klass))
      .toConstantValue(
        await rootWorker.getServiceRemotely(toRemoteName(klass)),
      );
  }
}
