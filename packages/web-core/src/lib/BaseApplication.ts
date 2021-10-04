import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { Remote, wrap } from 'comlink';
import { Container } from 'inversify';
import { BaseExtension } from './BaseExtension';
import { generateId } from './generateId';
import { RootWorker } from './RootWorker';
import { APPLICATION_ID, APPLICATION_NAME, WINDOW_ID } from './types';

const windowId = generateId();

export abstract class BaseApplication {
  private container: Container = new Container({ defaultScope: 'Singleton' });
  private worker!: Remote<RootWorker>;

  constructor(protected applicationId: string) {}

  async start() {
    this.container.bind(WINDOW_ID).toConstantValue(windowId);
    this.container.bind(APPLICATION_NAME).toConstantValue(this.applicationName);
    this.container.bind(APPLICATION_ID).toConstantValue(this.applicationId);

    this.worker = await this.loadWorker();

    await this.worker.registerProviders();

    const extensions = this.extensions.map((ext) => {
      return new ext(this, this.container, this.worker);
    });

    await Promise.all(
      extensions.map(async (ext) => {
        await ext.register();
      }),
    );

    await Promise.all(
      extensions.map(async (ext) => {
        await ext.onReady();
      }),
    );

    await this.onReady();
    return this.container;
  }

  private async loadWorker() {
    let worker = new this.workerClass();

    initBackend(worker);

    const Klass = wrap<RootWorker>(worker) as unknown as new (
      applicationName: string,
      applicationId: string,
      windowId: string,
    ) => Promise<Remote<RootWorker>>;

    return await new Klass(this.applicationName, this.applicationId, windowId);
  }

  abstract get workerClass(): any;
  abstract get applicationName(): string;
  abstract get extensions(): {
    new (
      application: BaseApplication,
      container: Container,
      rootWorker: Remote<RootWorker>,
    ): BaseExtension;
  }[];

  async onReady() {}
}
