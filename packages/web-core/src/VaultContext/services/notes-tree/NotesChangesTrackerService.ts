import { autorun } from 'mobx';
import { filter, map, Observable, takeUntil } from 'rxjs';
import { DatabaseChangeType, VaultDbTables } from '../../../dexieTypes';
import type { INoteChangeEvent } from '../../../dexieTypes';
import type { ITransmittedChange } from '../../../SqlNotesRepository';
import type {
  INoteTitleChange,
  NotesTreeModel,
} from '../../domain/NotesTree/NotesTreeModel';

export class NotesChangesTrackerService {
  private bufferedChanges: INoteChangeEvent[] = [];

  constructor(
    private changes$: Observable<ITransmittedChange[]>,
    private treeModel: NotesTreeModel,
    stop$: Observable<unknown>,
  ) {
    this.changes$
      .pipe(
        map(
          (chs) =>
            chs.filter(
              (ch) => ch.table === VaultDbTables.Notes,
            ) as INoteChangeEvent[],
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