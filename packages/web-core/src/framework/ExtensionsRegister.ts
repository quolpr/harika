import { Container } from 'inversify';
import { BaseExtension } from './BaseExtension';

export class ExtensionsRegister {
  constructor(
    private container: Container,
    private extensions: {
      new (...args: any): BaseExtension;
    }[],
  ) {}

  async register() {
    const extensions = this.extensions.map((ext) => {
      return this.container.resolve(ext);
    });

    await Promise.all(
      extensions.map(async (ext) => {
        await ext.register();
      }),
    );

    await Promise.all(
      extensions.map(async (ext) => {
        await ext.initialize();
      }),
    );

    await Promise.all(
      extensions.map(async (ext) => {
        await ext.onReady();
      }),
    );
  }
}
