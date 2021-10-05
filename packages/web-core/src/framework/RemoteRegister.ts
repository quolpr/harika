import { Remote } from 'comlink';
import { Container } from 'inversify';
import { RootWorker } from './RootWorker';
import { toRemoteName } from './utils';

type Class<T = any> = new (...args: any[]) => T;

export class RemoteRegister {
  constructor(
    private rootWorker: Remote<RootWorker>,
    private appContainer: Container,
  ) {}

  async registerRemote(klass: Class) {
    this.appContainer
      .bind(toRemoteName(klass))
      .toConstantValue(
        await this.rootWorker.getServiceRemotely(toRemoteName(klass)),
      );
  }

  getRemote<T>(klass: Class<T>) {
    return this.appContainer.get<Remote<T>>(toRemoteName(klass));
  }
}
