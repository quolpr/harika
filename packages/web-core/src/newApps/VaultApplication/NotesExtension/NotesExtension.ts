import { BaseExtension } from '../../../lib/BaseExtension';
import { NotesRepository } from './repositories/NotesRepository';

export class NotesExtension extends BaseExtension {
  async register() {
    await this.registerRemote(NotesRepository);
  }

  async onReady() {
    console.log(await this.getRemote(NotesRepository).getAll());
  }
}
