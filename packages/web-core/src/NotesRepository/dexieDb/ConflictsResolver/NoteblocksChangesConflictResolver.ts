import {
  DatabaseChangeType,
  ICreateChange,
  IDeleteChange,
  INoteBlockChangeEvent,
  IUpdateChange,
  NoteBlockDocType,
} from '@harika/common';
import { cloneDeep } from 'lodash';
import { difference, set, uniq } from 'lodash-es';
import { reduceChanges } from '../../../dexie-sync/reduceChanges';

export class NoteblocksChangesConflictResolver {
  resolveConflicts(
    clientChanges: INoteBlockChangeEvent[],
    serverChanges: INoteBlockChangeEvent[],
  ) {
    const reducedClientChanges = reduceChanges(clientChanges) as Record<
      string,
      INoteBlockChangeEvent
    >;
    const reducedServerChanges = reduceChanges(serverChanges) as Record<
      string,
      INoteBlockChangeEvent
    >;

    const mergedChanges: Record<string, INoteBlockChangeEvent> = {};

    Object.entries(reducedClientChanges).forEach(([key, clientChange]) => {
      if (!reducedServerChanges[key]) {
        mergedChanges[key] = clientChange;

        return;
      }

      mergedChanges[key] = this.resolveConflictedChanges(
        clientChange,
        reducedServerChanges[key],
      );
    });

    Object.entries(reducedServerChanges).forEach(([key, serverChange]) => {
      if (!mergedChanges[key]) {
        mergedChanges[key] = serverChange;
      }
    });

    const changesArray = Object.values(mergedChanges);

    return {
      changes: changesArray,
      touchedIds: changesArray.map((ch) => ch.key),
    };
  }

  private resolveConflictedChanges(
    clientChange: INoteBlockChangeEvent,
    serverChange: INoteBlockChangeEvent,
  ): INoteBlockChangeEvent {
    switch (clientChange.type) {
      case DatabaseChangeType.Create: {
        return clientChange;
      }

      case DatabaseChangeType.Update: {
        switch (serverChange.type) {
          case DatabaseChangeType.Create: {
            return serverChange;
          }

          case DatabaseChangeType.Update: {
            return this.resolveUpdateUpdate(clientChange, serverChange);
          }

          case DatabaseChangeType.Delete: {
            return this.resolveUpdateDelete(clientChange, serverChange);
          }
        }

        break;
      }

      case DatabaseChangeType.Delete: {
        switch (serverChange.type) {
          case DatabaseChangeType.Create: {
            return clientChange;
          }

          case DatabaseChangeType.Update: {
            return this.resolveUpdateDelete(serverChange, clientChange);
          }

          case DatabaseChangeType.Delete: {
            return clientChange;
          }
        }
      }
    }
  }

  private resolveUpdateUpdate(
    change1: IUpdateChange<'noteBlocks', NoteBlockDocType>,
    change2: IUpdateChange<'noteBlocks', NoteBlockDocType>,
  ): IUpdateChange<'noteBlocks', NoteBlockDocType> {
    let finalMods = {};

    const noteBlockIdsSelector = (_v: any, k: string) =>
      k.startsWith('noteBlockIdsMap');

    const noteBlockIds = this.resolveIds(
      change1.from.noteBlockIds || change2.from.noteBlockIds,
      change1.to.noteBlockIds,
      change2.to.noteBlockIds,
    );

    const linkedNoteIds = this.resolveIds(
      change1.from.linkedNoteIds || change2.from.linkedNoteIds,
      change1.to.linkedNoteIds,
      change2.to.linkedNoteIds,
    );

    finalMods = {
      ...finalMods,
      ...(linkedNoteIds === undefined ? {} : { linkedNoteIds }),
      ...(noteBlockIds === undefined ? {} : { noteBlockIds }),
      ...this.resolveContent(change1.to.content, change2.to.content),
    };

    return { ...change2, to: finalMods };
  }

  private resolveContent(
    content1: string | undefined,
    content2: string | undefined,
  ) {
    if (content1 === undefined && content2 === undefined) return {};
    if (content1 === undefined) return { content: content2 };
    if (content2 === undefined) return { content: content1 };

    return { content: `${content1}\n===\n${content2}` };
  }

  private resolveIds(
    startIds: string[] | undefined,
    ids1: string[] | undefined,
    ids2: string[] | undefined,
  ) {
    if (startIds === undefined) return;
    if (ids1 === undefined && ids2 === undefined) return;
    if (ids1 === undefined) return ids2;
    if (ids2 === undefined) return ids1;

    const removedIds = difference(startIds, ids1);
    removedIds.push(...difference(startIds, ids2));

    return uniq(ids1.concat(ids2).filter((id) => !removedIds.includes(id)));
  }

  private resolveUpdateDelete(
    change1: IUpdateChange<'noteBlocks', NoteBlockDocType>,
    change2: IDeleteChange<'noteBlocks', NoteBlockDocType>,
  ): ICreateChange<'noteBlocks', NoteBlockDocType> {
    const obj = cloneDeep(change2.obj);

    Object.entries(change1.to).forEach(function ([keyPath, val]) {
      set(obj, keyPath, val);
    });

    return {
      table: 'noteBlocks',
      type: DatabaseChangeType.Create,
      key: change1.key,
      source: change2.source,
      obj: obj,
    };
  }
}
