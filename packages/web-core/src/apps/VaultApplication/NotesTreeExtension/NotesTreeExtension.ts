import { inject, injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { NotesService } from '../NotesExtension/services/NotesService';
import { newTreeModel, NotesTreeRegistry } from './models/NotesTreeRegistry';
import { NotesChangesTrackerService } from './services/NotesChangesTrackerService';

@injectable()
export class NotesTreeExtension extends BaseExtension {
  async register() {
    this.container.bind(NotesChangesTrackerService).toSelf();
    this.container.bind(NotesTreeRegistry).toConstantValue(newTreeModel());
  }

  async onReady() {
    // Delayed to increase startup time
    setTimeout(async () => {
      const notesService = this.container.get(NotesService);

      this.container
        .get(NotesTreeRegistry)
        .initializeTree(await notesService.getTuplesWithoutDailyNotes());
    }, 200);
  }
}
