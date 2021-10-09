import { autorun } from 'mobx';
import { filter, map, Observable, takeUntil } from 'rxjs';
import type { ITransmittedChange } from '../../../../extensions/SyncExtension/persistence/SyncRepository';
import { DatabaseChangeType } from '../../../../extensions/SyncExtension/serverSynchronizer/types';
import type {
  INoteTitleChange,
  NotesTreeRegistry,
} from '../models/NotesTreeRegistry';
import { notesTable } from '../../NotesApp/repositories/NotesRepository';
import type { INoteChangeEvent } from '../../NotesApp/repositories/NotesRepository';

export class NotesChangesTrackerService {
  private bufferedChanges: INoteChangeEvent[] = [];

  constructor(
    private changes$: Observable<ITransmittedChange[]>,
    private treeModel: NotesTreeRegistry,
    stop$: Observable<unknown>,
  ) {
    this.changes$
      .pipe(
        map(
          (chs) =>
            chs.filter((ch) => ch.table === notesTable) as INoteChangeEvent[],
        ),
        filter((chs) => chs.length !== 0),
        takeUntil(stop$),
      )
      .subscribe((chs) => this.handleChanges(chs));

    const reactDisposer = autorun(() => {
      if (treeModel.isInitialized) {
        this.freeBuffer();

        reactDisposer();
      }
    });

    stop$.subscribe(() => {
      reactDisposer();
    });
  }

  handleChanges(changes: INoteChangeEvent[]) {
    if (!this.treeModel.isInitialized) {
      this.bufferedChanges.push(...changes);
      return;
    }

    this.treeModel.handleNotesChanges(
      changes
        .map((ch): INoteTitleChange | undefined => {
          if (ch.type === DatabaseChangeType.Create) {
            if (ch.obj.dailyNoteDate) return undefined;

            return { type: 'create', id: ch.key, title: ch.obj.title };
          } else if (ch.type === DatabaseChangeType.Update && ch.to.title) {
            return {
              type: 'rename',
              id: ch.key,
              toTitle: ch.to.title,
            };
          } else if (ch.type === DatabaseChangeType.Delete) {
            return {
              type: 'delete',
              id: ch.key,
            };
          }

          return undefined;
        })
        .filter((ch) => Boolean(ch)) as INoteTitleChange[],
    );
  }

  private freeBuffer() {
    if (this.bufferedChanges) {
      const changes = this.bufferedChanges;
      this.bufferedChanges = [];

      this.handleChanges(changes);
    }
  }
}
