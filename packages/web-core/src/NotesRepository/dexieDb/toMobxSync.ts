import type { VaultModel } from '../../NotesRepository';
import {
  convertNoteBlockDocToModelAttrs,
  convertNoteDocToModelAttrs,
  NoteBlockData,
  NoteData,
} from './convertDocToModel';
import type { VaultDexieDatabase } from './DexieDb';
import {
  INoteChangeEvent,
  DatabaseChangeType,
  INoteBlockChangeEvent,
} from '@harika/common';
import { changes$ } from '../../dexie-sync/changesChannel';

// type BufferDebounce = <T>(debounce: number) => OperatorFunction<T, T[]>;
// const bufferDebounce: BufferDebounce = (debounce) => (source) =>
//   new Observable((observer) =>
//     source.pipe(buffer(source.pipe(debounceTime(debounce)))).subscribe({
//       next(x) {
//         observer.next(x);
//       },
//       error(err: unknown) {
//         observer.error(err);
//       },
//       complete() {
//         observer.complete();
//       },
//     }),
//   );

export const toMobxSync = (
  db: VaultDexieDatabase,
  vault: VaultModel,
  currentWindowId: string,
) => {
  //const db$ = new Observable<IChangeEvent>((observer) => {
  //  const subscriber = (chs: IChangeEvent[]) => {
  //    chs.forEach((ch) => {
  //      observer.next(ch);
  //    });
  //  };

  //  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //  //@ts-ignore
  //  db.on('changes', subscriber);

  //  return () => {
  //    db.on('changes').unsubscribe(subscriber);
  //  };
  //});

  changes$.subscribe((evs) => {
    // TODO refactor notes and noteblocks to one method

    evs = evs.filter(
      ({ fromServer, windowId }) => fromServer || windowId !== currentWindowId,
    );
    console.log('new changes', evs);

    if (evs.length === 0) return;

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
          if (note) {
            return { ...note.$, isDeleted: true };
          } else {
            return undefined;
          }
        } else {
          if (!ev.obj) throw new Error('obj should be present');

          // Any changes we will load to mobx cause they may have refs
          return convertNoteDocToModelAttrs(
            ev.obj,
            Boolean(note?.areChildrenLoaded),
            Boolean(note?.areLinksLoaded),
            Boolean(note?.areBacklinksLoaded),
          );
        }
      });
    })();

    // TODO: better ref resolving logic - check that all needed ref of noteBlock are loaded
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
        const noteBlock = vault.blocksMap[ev.key];

        if (ev.type === DatabaseChangeType.Delete) {
          if (noteBlock) {
            return {
              ...noteBlock.$,
              isDeleted: true,
            };
          } else {
            return undefined;
          }
        } else {
          if (!ev.obj) throw new Error('obj should be present');

          // Any changes we will load to mobx cause they may have refs
          return convertNoteBlockDocToModelAttrs(ev.obj);
        }
      });
    })();

    vault.createOrUpdateEntitiesFromAttrs(
      notes.filter((n) => !!n) as NoteData[],
      blocks.filter((n) => !!n) as NoteBlockData[],
    );
  });

  // db$
  //   .pipe(
  //     filter((ch) => ch.source !== db.windowId),
  //     bufferDebounce(1000),
  //   )
};
