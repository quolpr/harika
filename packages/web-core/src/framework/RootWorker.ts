import { proxy } from 'comlink';
import type { ProxyMarked } from 'comlink';
import { Container } from 'inversify';
import 'reflect-metadata';
import { APPLICATION_ID, APPLICATION_NAME, WINDOW_ID } from './types';
import { ExtensionsRegister } from './ExtensionsRegister';
import { BaseExtension } from './BaseExtension';

export abstract class RootWorker {
  protected workerContainer: Container;

  constructor(
    applicationName: string,
    applicationId: string,
    windowId: string,
  ) {
    this.workerContainer = new Container({ defaultScope: 'Singleton' });

    this.workerContainer
      .bind(APPLICATION_NAME)
      .toConstantValue(applicationName);
    this.workerContainer.bind(APPLICATION_ID).toConstantValue(applicationId);
    this.workerContainer.bind(WINDOW_ID).toConstantValue(windowId);
    this.workerContainer.bind(Container).toConstantValue(this.workerContainer);
  }

  async registerProviders() {
    const extensions = await this.getExtensions();

    const extensionsRegister = new ExtensionsRegister(
      this.workerContainer,
      extensions,
    );

    await extensionsRegister.register();
  }

  getServiceRemotely<T>(name: any): T & ProxyMarked {
    return proxy(this.workerContainer.get<T>(name));
  }

  set(name: string, value: any) {
    this.workerContainer.bind(name).to(value);
  }

  abstract getExtensions(): Promise<
    {
      new (...args: any): BaseExtension;
    }[]
  >;
}
