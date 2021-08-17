import type { Observable } from 'dexie';
import type { ITransmittedChange } from '../../dexie-sync/changesChannel';
import {
  VaultDbTables,
  INoteChangeEvent,
  DatabaseChangeType,
  INoteBlockChangeEvent,
  IBlocksViewChangeEvent,
} from '../../dexieTypes';
import type { VaultModel } from '../domain/VaultModel';
import {
  convertNoteDocToModelAttrs,
  convertNoteBlockDocToModelAttrs,
  convertViewToModelAttrs,
  ViewData,
  NoteData,
  NoteBlockData,
} from './toDomainModelsConverters';

export class ToDomainSyncer {
  constructor(
    private changes$: Observable<ITransmittedChange[]>,
    private vault: VaultModel,
    private currentWindowId: string,
  ) {}

  start() {
    this.changes$.subscribe((evs) => {
      console.log({ evs });

      evs = evs.filter(
        ({ fromServer, windowId, transactionSource }) =>
          // we are going to pick all events except one that came from current mobx
          fromServer ||
          windowId !== this.currentWindowId ||
          transactionSource === 'conflictsResolution',
      );

      if (evs.length === 0) return;

      const blockViews = this.getViews(evs);

      if (blockViews.length > 0) {
        this.vault.ui.createOrUpdateEntitiesFromAttrs(blockViews);
      }

      this.vault.createOrUpdateEntitiesFromAttrs(
        this.getNoteChanges(evs),
        this.getBlockChanges(evs),
      );
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
        const noteBlock = this.vault.getNoteBlock(ev.key);

        if (
          ev.type === DatabaseChangeType.Create &&
          this.vault.isBlockTreeHolderExists(ev.obj.noteId)
        ) {
          return convertNoteBlockDocToModelAttrs(ev.obj);
        } else if (ev.type === DatabaseChangeType.Delete && noteBlock) {
          return {
            ...noteBlock.$,
            isDeleted: true,
          };
        } else if (ev.type === DatabaseChangeType.Update && noteBlock) {
          if (!ev.obj) throw new Error('obj should be present');

          // Any changes we will load to mobx cause they may have refs
          return convertNoteBlockDocToModelAttrs(ev.obj);
        }

        return undefined;
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

        if (!note) return undefined;

        if (ev.type === DatabaseChangeType.Delete) {
          return { ...note.$, isDeleted: true };
        } else {
          if (!ev.obj) throw new Error('obj should be present');

          // Any changes we will load to mobx cause they may have refs
          return convertNoteDocToModelAttrs(ev.obj);
        }
      })
      .filter((n) => !!n) as NoteData[];
  }
}
