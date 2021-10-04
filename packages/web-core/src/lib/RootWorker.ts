import { proxy } from 'comlink';
import type { ProxyMarked } from 'comlink';
import { Container } from 'inversify';
import { BaseWorkerProvider } from './BaseWorkerProvider';
import 'reflect-metadata';
import { APPLICATION_ID, APPLICATION_NAME, WINDOW_ID } from './types';

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
  }

  async registerProviders() {
    const providers = await this.getProviders();
    await Promise.all(
      providers.map(async (provider) => {
        await provider.register();
      }),
    );

    await Promise.all(
      providers.map(async (provider) => {
        await provider.initialize();
      }),
    );

    await Promise.all(
      providers.map(async (provider) => {
        await provider.onReady();
      }),
    );
  }

  getServiceRemotely<T>(name: any): T & ProxyMarked {
    return proxy(this.workerContainer.get<T>(name));
  }

  set(name: string, value: any) {
    this.workerContainer.bind(name).to(value);
  }

  abstract getProviders(): Promise<BaseWorkerProvider[]>;
}
