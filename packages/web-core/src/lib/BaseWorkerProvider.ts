import { Container } from 'inversify';
import { toRemoteName } from './utils';

type Class<T = any> = new (...args: any[]) => T;
export abstract class BaseWorkerProvider {
  constructor(protected workerContainer: Container) {}

  abstract register(): Promise<void>;

  async initialize(): Promise<void> {}

  async onReady(): Promise<void> {}

  protected registerRemote(klass: Class) {
    this.workerContainer
      .bind(toRemoteName(klass))
      .toDynamicValue(() => this.workerContainer.get(klass));
  }
}
