import type { Observable } from 'dexie';
import { autorun } from 'mobx';
import type { INoteChangeEvent } from '../../../dexieTypes';
import type { NotesTreeModel } from './NotesTreeModel';

export class NotesChangesTracker {
  private bufferedChanges: INoteChangeEvent[] = [];

  constructor(
    private treeModel: NotesTreeModel,
    private stop$: Observable<unknown>,
  ) {
    const reactDisposer = autorun(() => {
      if (treeModel.isInitialized) {
        this.freeBuffer();

        reactDisposer();
      }
    });

    this.stop$.subscribe(() => {
      reactDisposer();
    });
  }

  handleChanges(changes: INoteChangeEvent[]) {
    if (!this.treeModel.isInitialized) {
      this.bufferedChanges.push(...changes);
      return;
    }

    this.treeModel.handleNotesChanges(changes);
  }

  private freeBuffer() {
    if (this.bufferedChanges) {
      const changes = this.bufferedChanges;
      this.bufferedChanges = [];

      this.handleChanges(changes);
    }
  }
}
