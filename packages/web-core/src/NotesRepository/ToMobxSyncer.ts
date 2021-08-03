import type { Observable } from 'dexie';
import type { ITransmittedChange } from '../dexie-sync/changesChannel';
import {
  VaultDbTables,
  INoteChangeEvent,
  DatabaseChangeType,
  INoteBlockChangeEvent,
  IBlocksViewChangeEvent,
} from '../dexieTypes';
import type { VaultModel } from './models/VaultModel';
import {
  convertNoteDocToModelAttrs,
  convertNoteBlockDocToModelAttrs,
  convertViewToModelAttrs,
  ViewData,
  NoteData,
  NoteBlockData,
} from './dexieDb/toModelDataConverters';

export class ToMobxSyncer {
  constructor(
    private changes$: Observable<ITransmittedChange[]>,
    private vault: VaultModel,
    private currentWindowId: string,
  ) {}

  start() {
    this.changes$.subscribe((evs) => {
      evs = evs.filter(
        ({ fromServer, windowId, transactionSource }) =>
          // we are going to pick all events except one that came from current mobx
          fromServer ||
          windowId !== this.currentWindowId ||
          transactionSource === 'conflictsResolution',
      );

      if (evs.length === 0) return;

      const blockViews = this.getViews(evs);

      this.vault.createOrUpdateEntitiesFromAttrs(
        this.getNoteChanges(evs),
        this.getBlockChanges(evs),
      );

      if (blockViews.length > 0) {
        this.vault.ui.createOrUpdateEntitiesFromAttrs(blockViews);
      }
    });
  }

  private getViews(evs: ITransmittedChange[]) {
    const viewEvents = evs.filter(
      (ev) => ev.table === VaultDbTables.BlocksViews,
    ) as IBlocksViewChangeEvent[];

    const latestDedupedEvents: Record<string, IBlocksViewChangeEvent> = {};

    viewEvents.reverse().forEach((ev) => {
      if (!latestDedupedEvents[ev.key]) {
        latestDedupedEvents[ev.key] = ev;
      }
    });

    return viewEvents
      .map((ev) => {
        if (!ev.obj) return undefined;

        return convertViewToModelAttrs(ev.obj);
      })
      .filter((n) => !!n) as ViewData[];
  }

  // TODO refactor notes and noteblocks to one method

  private getBlockChanges(evs: ITransmittedChange[]) {
    // TODO: better ref resolving logic - check that all needed ref of noteBlock are loaded
    const blockEvents = evs.filter(
      (ev) => ev.table === VaultDbTables.NoteBlocks,
    ) as INoteBlockChangeEvent[];

    const latestDedupedEvents: Record<string, INoteBlockChangeEvent> = {};

    blockEvents.reverse().forEach((ev) => {
      if (!latestDedupedEvents[ev.key]) {
        latestDedupedEvents[ev.key] = ev;
      }
    });

    return Object.values(latestDedupedEvents)
      .map((ev) => {
        const noteBlock = this.vault.blocksMap[ev.key];

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
      })
      .filter((n) => !!n) as NoteBlockData[];
  }

  private getNoteChanges(evs: ITransmittedChange[]) {
    const noteEvents = evs.filter(
      (ev) => ev.table === VaultDbTables.Notes,
    ) as INoteChangeEvent[];

    const latestDedupedEvents: Record<string, INoteChangeEvent> = {};

    noteEvents.reverse().forEach((ev) => {
      if (!latestDedupedEvents[ev.key]) {
        latestDedupedEvents[ev.key] = ev;
      }
    });

    return Object.values(latestDedupedEvents)
      .map((ev) => {
        const note = this.vault.notesMap[ev.key];

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
      })
      .filter((n) => !!n) as NoteData[];
  }
}
