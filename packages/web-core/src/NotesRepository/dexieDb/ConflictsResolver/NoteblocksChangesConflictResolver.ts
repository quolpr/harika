import {
  DatabaseChangeType,
  ICreateChange,
  IDeleteChange,
  INoteBlockChangeEvent,
  IUpdateChange,
  NoteBlockDocType,
} from '@harika/common';
import { cloneDeep } from 'lodash';
import { pickBy, set } from 'lodash-es';
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

    const linkedNoteIdsSelector = (_v: any, k: string) =>
      k.startsWith('linkedNoteIdsMap');

    finalMods = {
      ...finalMods,
      ...this.resolveIds(
        pickBy(change1.mods, noteBlockIdsSelector),
        pickBy(change2.mods, noteBlockIdsSelector),
      ),
      ...this.resolveIds(
        pickBy(change1.mods, linkedNoteIdsSelector),
        pickBy(change2.mods, linkedNoteIdsSelector),
      ),
      ...this.resolveContent(change1.mods.content, change2.mods.content),
    };

    return { ...change2, mods: finalMods };
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

  private resolveIds(mods1: Record<string, any>, mods2: Record<string, any>) {
    if (Object.values(mods1).length === 0) return mods2;
    if (Object.values(mods2).length === 0) return mods1;

    const baseMods = cloneDeep(mods1);

    Object.entries(mods2).forEach(([k, v]: [string, number | null]) => {
      if (baseMods[k] && baseMods[k] === null) return;

      baseMods[k] = v;
    });

    return baseMods;
  }

  private resolveUpdateDelete(
    change1: IUpdateChange<'noteBlocks', NoteBlockDocType>,
    change2: IDeleteChange<'noteBlocks', NoteBlockDocType>,
  ): ICreateChange<'noteBlocks', NoteBlockDocType> {
    const obj = cloneDeep(change2.obj);

    Object.entries(change1.mods).forEach(function ([keyPath, val]) {
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
