import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { Remote, wrap } from 'comlink';
import { Container } from 'inversify';
import { BaseExtension } from './BaseExtension';
import { generateId } from '../lib/generateId';
import { RootWorker } from './RootWorker';
import {
  APPLICATION_ID,
  APPLICATION_NAME,
  ROOT_WORKER,
  STOP_SIGNAL,
  WINDOW_ID,
} from './types';
import { RemoteRegister } from './RemoteRegister';
import { ExtensionsRegister } from './ExtensionsRegister';
import { Subject } from 'rxjs';

const windowId = generateId();

export abstract class BaseApplication {
  protected stop$ = new Subject<void>();

  protected container: Container = new Container({ defaultScope: 'Singleton' });
  private worker!: Remote<RootWorker>;

  constructor(public applicationId: string) {}

  async start() {
    this.container.bind(STOP_SIGNAL).toConstantValue(this.stop$);
    this.container.bind(WINDOW_ID).toConstantValue(windowId);
    this.container.bind(APPLICATION_NAME).toConstantValue(this.applicationName);
    this.container.bind(APPLICATION_ID).toConstantValue(this.applicationId);
    this.container.bind(Container).toConstantValue(this.container);

    this.worker = await this.loadWorker();

    await this.register();
    await this.worker.registerProviders();

    this.container.bind(ROOT_WORKER).toConstantValue(this.worker);
    this.container
      .bind(RemoteRegister)
      .toConstantValue(new RemoteRegister(this.worker, this.container));

    const extensionsRegister = new ExtensionsRegister(
      this.container,
      this.extensions,
    );

    await extensionsRegister.register();

    await this.initialize();
    await this.onReady();

    return this.container;
  }

  private async loadWorker() {
    let worker = this.workerClass();

    initBackend(worker);

    const Klass = wrap<RootWorker>(worker) as unknown as new (
      applicationName: string,
      applicationId: string,
      windowId: string,
    ) => Promise<Remote<RootWorker>>;

    const res = await new Klass(
      this.applicationName,
      this.applicationId,
      windowId,
    );

    return res;
  }

  abstract get workerClass(): any;
  abstract get applicationName(): string;
  abstract get extensions(): {
    new (...args: any): BaseExtension;
  }[];

  async register() {}
  async initialize() {}
  async onReady() {}

  stop() {}
}
