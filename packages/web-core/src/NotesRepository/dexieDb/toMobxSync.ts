import { Observable, OperatorFunction } from 'rxjs';
import { buffer, debounceTime, filter } from 'rxjs/operators';
import type { NotesRepository, VaultModel } from '../../NotesRepository';
import {
  convertNoteBlockDocToModelAttrs,
  convertNoteDocToModelAttrs,
  NoteBlockData,
  NoteData,
} from './convertDocToModel';
import type { VaultDexieDatabase } from './DexieDb';
import {
  IChangeEvent,
  INoteChangeEvent,
  DatabaseChangeType,
  INoteBlockChangeEvent,
} from '@harika/common';

type BufferDebounce = <T>(debounce: number) => OperatorFunction<T, T[]>;
const bufferDebounce: BufferDebounce = (debounce) => (source) =>
  new Observable((observer) =>
    source.pipe(buffer(source.pipe(debounceTime(debounce)))).subscribe({
      next(x) {
        observer.next(x);
      },
      error(err) {
        observer.error(err);
      },
      complete() {
        observer.complete();
      },
    }),
  );

export const toMobxSync = (db: VaultDexieDatabase, vault: VaultModel) => {
  const db$ = new Observable<IChangeEvent>((observer) => {
    const subscriber = (chs: IChangeEvent[]) => {
      chs.forEach((ch) => {
        observer.next(ch);
      });
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    db.on('changes', subscriber);

    return () => {
      db.on('changes').unsubscribe(subscriber);
    };
  });

  db$
    .pipe(
      filter((ch) => ch.source !== db.windowId),
      bufferDebounce(1000),
    )
    .subscribe((evs) => {
      const notes = (() => {
        const noteEvents = evs.filter(
          (ev) => ev.table === 'notes',
        ) as INoteChangeEvent[];

        const latestDedupedEvents: Record<string, INoteChangeEvent> = {};

        noteEvents.reverse().forEach((ev) => {
          if (!latestDedupedEvents[ev.key]) {
            latestDedupedEvents[ev.key] = ev;
          }
        });

        return Object.values(latestDedupedEvents).map((ev) => {
          const note = vault.notesMap[ev.key];

          if (ev.type === DatabaseChangeType.Delete) {
            if (!ev.oldObj) {
              console.error('FIXME ev.oldObj is null', ev);
              return undefined;
            }

            return {
              ...convertNoteDocToModelAttrs(
                ev.oldObj,
                Boolean(note?.areChildrenLoaded),
                Boolean(note?.areLinksLoaded),
              ),
              isDeleted: true,
            };
          } else {
            if (!ev.obj) throw new Error('obj should be present');

            return convertNoteDocToModelAttrs(
              ev.obj,
              Boolean(note?.areChildrenLoaded),
              Boolean(note?.areLinksLoaded),
            );
          }
        });
      })();

      const blocks = (() => {
        const blockEvents = evs.filter(
          (ev) => ev.table === 'noteBlocks',
        ) as INoteBlockChangeEvent[];

        const latestDedupedEvents: Record<string, INoteBlockChangeEvent> = {};

        blockEvents.reverse().forEach((ev) => {
          if (!latestDedupedEvents[ev.key]) {
            latestDedupedEvents[ev.key] = ev;
          }
        });

        return Object.values(latestDedupedEvents).map((ev) => {
          if (ev.type === DatabaseChangeType.Delete) {
            if (!ev.oldObj) {
              console.error('FIXME ev.oldObj is null', ev);
              return undefined;
            }

            return {
              ...convertNoteBlockDocToModelAttrs(ev.oldObj),
              isDeleted: true,
            };
          } else {
            if (!ev.obj) throw new Error('obj should be present');

            return convertNoteBlockDocToModelAttrs(ev.obj);
          }
        });
      })();

      vault.createOrUpdateEntitiesFromAttrs(
        notes.filter((n) => !!n) as NoteData[],
        blocks.filter((n) => !!n) as NoteBlockData[],
      );
    });
};
