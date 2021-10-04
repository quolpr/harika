import { ProxyMarked, Remote } from 'comlink';
import { Container } from 'inversify';
import { BaseApplication } from './BaseApplication';
import { RootWorker } from './RootWorker';

type Class<T = any> = new (...args: any[]) => T;
const toRemoteName = (klass: Class) => {
  return `remote.${klass.name}`;
};

export abstract class BaseExtension {
  constructor(
    protected application: BaseApplication,
    protected appContainer: Container,
    protected rootWorker: Remote<RootWorker>,
  ) {}

  abstract register(): Promise<void>;

  async onReady() {}

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
