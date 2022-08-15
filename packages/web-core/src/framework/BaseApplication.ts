import { Container } from 'inversify';
import { Subject } from 'rxjs';

import { generateId } from '../lib/generateId';
import { BaseExtension } from './BaseExtension';
import {
  APPLICATION_ID,
  APPLICATION_NAME,
  STOP_SIGNAL,
  WINDOW_ID,
} from './types';

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

    const extensions = this.extensions.map((ext) => {
      return this.container.resolve(ext);
    });

    await Promise.all(
      extensions.map(async (ext) => {
        await ext.register();
      }),
    );
    await this.register();

    await Promise.all(
      extensions.map(async (ext) => {
        await ext.initialize();
      }),
    );
    await this.initialize();

    await Promise.all(
      extensions.map(async (ext) => {
        await ext.onReady();
      }),
    );
    await this.onReady();

    return this.container;
  }

  abstract get applicationName(): string;
  abstract get extensions(): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (...args: any): BaseExtension;
  }[];

  async register() {}
  async initialize() {}
  async onReady() {}

  stop() {}
}
