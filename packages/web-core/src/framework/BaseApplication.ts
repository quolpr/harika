import { Container } from 'inversify';
import { BaseExtension } from './BaseExtension';
import { generateId } from '../lib/generateId';
import {
  APPLICATION_ID,
  APPLICATION_NAME,
  STOP_SIGNAL,
  WINDOW_ID,
} from './types';
import { ExtensionsRegister } from './ExtensionsRegister';
import { Subject } from 'rxjs';

const windowId = generateId();

export abstract class BaseApplication {
  protected stop$ = new Subject<void>();

  protected container: Container = new Container({ defaultScope: 'Singleton' });

  constructor(public applicationId: string) {}

  async start() {
    this.container.bind(STOP_SIGNAL).toConstantValue(this.stop$);
    this.container.bind(WINDOW_ID).toConstantValue(windowId);
    this.container.bind(APPLICATION_NAME).toConstantValue(this.applicationName);
    this.container.bind(APPLICATION_ID).toConstantValue(this.applicationId);
    this.container.bind(Container).toConstantValue(this.container);

    await this.register();

    const extensionsRegister = new ExtensionsRegister(
      this.container,
      this.extensions,
    );

    await extensionsRegister.register();

    await this.initialize();
    await this.onReady();

    return this.container;
  }

  abstract get applicationName(): string;
  abstract get extensions(): {
    new (...args: any): BaseExtension;
  }[];

  async register() {}
  async initialize() {}
  async onReady() {}

  stop() {}
}
