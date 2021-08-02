import type { VaultModel } from '../NotesRepository';
import {
  INoteChangeEvent,
  DatabaseChangeType,
  INoteBlockChangeEvent,
  VaultDbTables,
  IBlocksViewChangeEvent,
} from '../../dexieTypes';
import { changes$ } from '../../dexie-sync/changesChannel';
import {
  convertNoteBlockDocToModelAttrs,
  convertNoteDocToModelAttrs,
  convertViewToModelAttrs,
  NoteBlockData,
  NoteData,
  ViewData,
} from './toModelDataConverters';

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

export const toMobxSync = (vault: VaultModel, currentWindowId: string) => {
  changes$.subscribe((evs) => {
    // TODO refactor notes and noteblocks to one method

    evs = evs.filter(
      ({ fromServer, windowId, transactionSource }) =>
        fromServer ||
        windowId !== currentWindowId ||
        transactionSource === 'conflictsResolution',
    );

    if (evs.length === 0) return;

    const notes = (() => {
      const noteEvents = evs.filter(
        (ev) => ev.table === VaultDbTables.Notes,
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
          return convertNoteDocToModelAttrs(ev.obj, {
            areChildrenLoaded: false,
            areNoteLinksLoaded: false,
            areBlockLinksLoaded: false,
          });
        }
      });
    })();

    // TODO: better ref resolving logic - check that all needed ref of noteBlock are loaded
    const blocks = (() => {
      const blockEvents = evs.filter(
        (ev) => ev.table === VaultDbTables.NoteBlocks,
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

    const blockViews = (() => {
      const viewEvents = evs.filter(
        (ev) => ev.table === VaultDbTables.BlocksViews,
      ) as IBlocksViewChangeEvent[];

      const latestDedupedEvents: Record<string, IBlocksViewChangeEvent> = {};

      viewEvents.reverse().forEach((ev) => {
        if (!latestDedupedEvents[ev.key]) {
          latestDedupedEvents[ev.key] = ev;
        }
      });

      return viewEvents.map((ev) => {
        if (!ev.obj) return undefined;

        return convertViewToModelAttrs(ev.obj);
      });
    })().filter((n) => !!n) as ViewData[];

    vault.createOrUpdateEntitiesFromAttrs(
      notes.filter((n) => !!n) as NoteData[],
      blocks.filter((n) => !!n) as NoteBlockData[],
    );

    if (blockViews.length > 0) {
      vault.ui.createOrUpdateEntitiesFromAttrs(blockViews);
    }
  });
};
