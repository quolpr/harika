import { Container, inject, injectable } from 'inversify';

@injectable()
export abstract class BaseExtension {
  @inject(Container) protected container!: Container;

  abstract register(): Promise<void>;

  async initialize() {}
  async onReady() {}

  setContainer(container: Container) {
    this.container = container;
  }
}
