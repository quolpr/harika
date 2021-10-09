import { Container, inject, injectable } from 'inversify';

@injectable()
export abstract class BaseExtension {
  @inject(Container) protected container!: Container;

  abstract register(): Promise<void>;

  async initialize(): Promise<(() => void) | void> {}
  async onReady() {}
  async onDestroy() {}

  setContainer(container: Container) {
    this.container = container;
  }
}
