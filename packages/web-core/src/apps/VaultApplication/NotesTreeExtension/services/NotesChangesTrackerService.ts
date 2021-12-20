import { autorun } from 'mobx';
import { filter, map, Observable, takeUntil } from 'rxjs';
import {
  INoteTitleChange,
  NotesTreeRegistry,
} from '../models/NotesTreeRegistry';
import {
  INoteChangeEvent,
  notesTable,
} from '../../NotesExtension/repositories/NotesRepository';
import { inject, injectable } from 'inversify';
import { STOP_SIGNAL } from '../../../../framework/types';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { DocChangeType } from '@harika/sync-common';

@injectable()
export class NotesChangesTrackerService {
  private bufferedChanges: INoteChangeEvent[] = [];

  constructor(
    @inject(DbEventsListenService)
    dbChangeListenService: DbEventsListenService,
    @inject(NotesTreeRegistry) private treeModel: NotesTreeRegistry,
    @inject(STOP_SIGNAL) stop$: Observable<unknown>,
  ) {
    dbChangeListenService
      .changesChannel$()
      .pipe(
        map(
          (chs) =>
            chs.filter(
              (ch) => ch.collectionName === notesTable,
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
          if (ch.type === DocChangeType.Create) {
            if (ch.doc.dailyNoteDate) return undefined;

            return { type: 'create', id: ch.docId, title: ch.doc.title };
          } else if (ch.type === DocChangeType.Update && ch.to.title) {
            return {
              type: 'rename',
              id: ch.docId,
              toTitle: ch.to.title,
            };
          } else if (ch.type === DocChangeType.Delete) {
            return {
              type: 'delete',
              id: ch.docId,
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
