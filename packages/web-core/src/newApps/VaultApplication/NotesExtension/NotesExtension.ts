import { Container, inject, injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import { NotesRepository } from './repositories/NotesRepository';

@injectable()
export class NotesExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    await this.remoteRegister.registerRemote(NotesRepository);
  }

  async onReady() {
    console.log(await this.remoteRegister.getRemote(NotesRepository).getAll());
  }
}
