import type { Observable } from 'rxjs';
import type { Vault } from '../domain/Vault';
import {
  convertNoteDocToModelAttrs,
  convertNoteBlockDocToModelAttrs,
} from '../converters/toDomainModelsConverters';
import type {
  NoteData,
  NoteBlockData,
} from '../converters/toDomainModelsConverters';
import type { ITransmittedChange } from '../../db-sync/persistence/SyncRepository';
import { DatabaseChangeType } from '../../db-sync/synchronizer/types';
import { noteBlocksTable } from '../persistence/NotesBlocksRepository';
import type { INoteBlockChangeEvent } from '../persistence/NotesBlocksRepository';
import type { INoteChangeEvent } from '../persistence/NotesRepository';
import { notesTable } from '../persistence/NotesRepository';
import { blocksScopesTable } from '../persistence/BlockScopesRepository';
import type { IBlocksScopesChangeEvent } from '../persistence/BlockScopesRepository';

export class ToDomainSyncer {
  constructor(
    private changes$: Observable<ITransmittedChange[]>,
    private vault: Vault,
    private currentWindowId: string,
  ) {}

  start() {
    this.changes$.subscribe((evs) => {
      evs = evs.filter(
        ({ windowId, source }) =>
          // we are going to pick all events except one that came from current mobx
          windowId !== this.currentWindowId || source === 'inDbChanges',
      );

      console.log('New events need handle by mobx', JSON.stringify(evs));

      if (evs.length === 0) return;

      const scopes = this.getScopes(evs);

      if (scopes.length > 0) {
        this.vault.noteBlocksApp.createOrUpdateScopesFromAttrs(scopes);
      }

      const notesChanges = this.getNoteChanges(evs);
      const blockChanges = this.getBlockChanges(evs);

      this.vault.createOrUpdateEntitiesFromAttrs(
        notesChanges,
        blockChanges,
        false,
      );
    });
  }

  private getScopes(evs: ITransmittedChange[]) {
    const scopedEvents = evs.filter(
      (ev) => ev.table === blocksScopesTable,
    ) as IBlocksScopesChangeEvent[];

    const latestDedupedEvents: Record<string, IBlocksScopesChangeEvent> = {};

    scopedEvents.reverse().forEach((ev) => {
      if (!latestDedupedEvents[ev.key]) {
        latestDedupedEvents[ev.key] = ev;
      }
    });

    return scopedEvents
      .map(({ obj }) =>
        obj
          ? {
              id: obj.id,
              collapsedBlockIds: obj.collapsedBlockIds,
            }
          : undefined,
      )
      .filter((v) => !!v) as { id: string; collapsedBlockIds: string[] }[];
  }

  // TODO refactor notes and noteblocks to one method

  private getBlockChanges(evs: ITransmittedChange[]) {
    const blockEvents = evs.filter(
      (ev) => ev.table === noteBlocksTable,
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

        if (ev.type === DatabaseChangeType.Create) {
          return convertNoteBlockDocToModelAttrs(ev.obj);
        } else if (ev.type === DatabaseChangeType.Delete && noteBlock) {
          return {
            ...convertNoteBlockDocToModelAttrs(ev.obj),
            isDeleted: true,
          };
        } else if (ev.type === DatabaseChangeType.Update) {
          if (!ev.obj) throw new Error('obj should be present');

          return convertNoteBlockDocToModelAttrs(ev.obj);
        }

        return undefined;
      })
      .filter((n) => !!n) as NoteBlockData[];
  }

  private getNoteChanges(evs: ITransmittedChange[]) {
    const noteEvents = evs.filter(
      (ev) => ev.table === notesTable,
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
