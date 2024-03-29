import { injectable } from 'inversify';

import { BaseExtension } from '../../../framework/BaseExtension';
import { NoteBlocksService } from '../BlocksExtension/services/NoteBlocksService';
import { newTreeModel, NotesTreeRegistry } from './models/NotesTreeRegistry';
import { NotesChangesTrackerService } from './services/NotesChangesTrackerService';

@injectable()
export class NotesTreeAppExtension extends BaseExtension {
  async register() {
    this.container.bind(NotesTreeRegistry).toConstantValue(newTreeModel());
  }

  async onReady() {
    this.container.resolve(NotesChangesTrackerService);

    // Delayed to increase startup time
    setTimeout(async () => {
      const notesService = this.container.get(NoteBlocksService);

      this.container
        .get(NotesTreeRegistry)
        .initializeTree(await notesService.getTuplesWithoutDailyNotes());
    }, 200);
  }
}
