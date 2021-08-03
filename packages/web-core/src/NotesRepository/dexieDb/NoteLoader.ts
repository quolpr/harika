import { uniq } from 'lodash-es';
import { areNeededNoteDataLoaded, INoteLoadStatus } from '../models/NoteModel';
import type { VaultDexieDatabase } from './DexieDb';
import {
  NoteData,
  NoteBlockData,
  convertNoteDocToModelAttrs,
  convertNoteBlockDocToModelAttrs,
} from './toModelDataConverters';

export interface ToPreloadInfo {
  preloadChildren: boolean;
  preloadBlockLinks: boolean;
  preloadNoteLinks: boolean;
}

class PreloadStore {
  private notes: Record<string, NoteData> = {};
  private noteBlocks: Record<string, NoteBlockData> = {};

  constructor(private statuses: Record<string, INoteLoadStatus>) {}

  getNoteStatus(noteId: string): INoteLoadStatus | undefined {
    return this.statuses[noteId];
  }

  setNoteStatus(noteId: string, status: INoteLoadStatus) {
    this.statuses[noteId] = status;
  }

  areNeededNoteDataLoaded(noteId: string, toPreloadInfo: ToPreloadInfo) {
    const status = this.getNoteStatus(noteId);

    if (!status) return false;

    return areNeededNoteDataLoaded(status, toPreloadInfo);
  }

  addNote(data: NoteData) {
    this.notes[data.$modelId] = data;

    this.setNoteStatus(data.$modelId, {
      areBlockLinksLoaded: data.areBlockLinksLoaded,
      areChildrenLoaded: data.areChildrenLoaded,
      areNoteLinksLoaded: data.areNoteLinksLoaded,
    });
  }

  addNoteBlocks(blocks: NoteBlockData[]) {
    blocks.forEach((block) => {
      this.noteBlocks[block.$modelId] = block;
    });
  }

  dump() {
    return {
      notes: Object.values(this.notes),
      noteBlocks: Object.values(this.noteBlocks),
    };
  }
}

export class NoteLoader {
  private preloadStore: PreloadStore;

  constructor(
    private db: VaultDexieDatabase,
    statuses: Record<string, INoteLoadStatus>,
    private noteId: string,
    private toPreloadInfo: ToPreloadInfo,
  ) {
    this.preloadStore = new PreloadStore(statuses);
  }

  async loadNote() {
    await this.doLoadNote(this.noteId, this.toPreloadInfo);

    return this.preloadStore.dump();
  }

  private async doLoadNote(noteId: string, toPreloadInfo: ToPreloadInfo) {
    if (this.preloadStore.areNeededNoteDataLoaded(noteId, toPreloadInfo)) {
      console.log(noteId, 'loaded');
      return;
    }

    const noteDoc = await this.db.notes.get(noteId);

    if (!noteDoc) {
      console.error(`Note with id ${noteId} not found`);

      return;
    }

    this.preloadStore.addNote(
      convertNoteDocToModelAttrs(noteDoc, {
        areBlockLinksLoaded: toPreloadInfo.preloadNoteLinks,
        areChildrenLoaded: toPreloadInfo.preloadChildren,
        areNoteLinksLoaded: toPreloadInfo.preloadNoteLinks,
      }),
    );

    const noteBlockAttrs = toPreloadInfo.preloadChildren
      ? await this.preloadChildren(noteId)
      : [];

    if (toPreloadInfo.preloadNoteLinks) {
      await this.preloadBacklinks(noteId);
    }

    if (toPreloadInfo.preloadBlockLinks) {
      const noteIds = uniq(
        noteBlockAttrs.flatMap(({ linkedNoteRefs }) =>
          (linkedNoteRefs || []).map(({ id }) => id),
        ),
      );

      await Promise.all(
        noteIds.map((id) =>
          this.doLoadNote(id, {
            preloadChildren: false,
            preloadBlockLinks: false,
            preloadNoteLinks: false,
          }),
        ),
      );
    }
  }

  private async preloadChildren(noteId: string) {
    const noteBlockAttrs = await Promise.all(
      (
        await this.db.noteBlocksQueries.getByNoteId(noteId)
      ).map((m) => convertNoteBlockDocToModelAttrs(m)),
    );

    this.preloadStore.addNoteBlocks(noteBlockAttrs);

    return noteBlockAttrs;
  }

  private async preloadBacklinks(noteId: string) {
    await Promise.all(
      (
        await this.db.notesQueries.getLinkedNoteIdsOfNoteId(noteId)
      ).map((linkedNoteId) =>
        this.doLoadNote(linkedNoteId, {
          preloadChildren: true,
          preloadBlockLinks: true,
          preloadNoteLinks: false,
        }),
      ),
    );
  }
}
