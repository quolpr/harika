import { Collection, Database } from '@nozbe/watermelondb';
import { ModelPropsData, Patch } from 'mobx-keystone';
import { NoteBlockModel } from './models/NoteBlockModel';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { NoteRow } from './db/rows/NoteRow';
import { Queries } from './db/Queries';
import { HarikaNotesTableName } from './db/schema';
import { NoteModel } from './models/NoteModel';
import { Store } from './Store';
import { Subject } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { Syncher } from './sync';
import isEqual from 'lodash.isequal';

export class ChangesHandler {
  notesCollection: Collection<NoteRow>;
  noteBlocksCollection: Collection<NoteBlockRow>;
  patchesSubject: Subject<Patch>;

  constructor(
    private database: Database,
    private queries: Queries,
    private store: Store,
    private syncher: Syncher
  ) {
    this.notesCollection = this.database.collections.get<NoteRow>(
      HarikaNotesTableName.NOTES
    );

    this.noteBlocksCollection = this.database.collections.get<NoteBlockRow>(
      HarikaNotesTableName.NOTE_BLOCKS
    );

    this.patchesSubject = new Subject<Patch>();

    this.patchesSubject
      .pipe(concatMap((patch) => this.applyPatch(patch)))
      .subscribe();
  }

  handlePatch = (patches: Patch[]) => {
    patches.forEach((patch) => {
      this.patchesSubject.next(patch);
    });
  };

  private applyPatch = async (patch: Patch) => {
    const path = patch.path;

    if (
      path.length === 4 &&
      path[0] === 'notesMap' &&
      path[2] === 'childBlockRefs'
    ) {
      const note = await this.queries.notesCollection.find(
        patch.path[1] as string
      );

      const ids = this.store.notesMap[path[1]].childBlockRefs.map(
        ({ current }) => current.$modelId
      );
      if (!isEqual(ids, note.childBlockIds)) {
        await this.database.action(() => {
          return note.update((toUpdate) => {
            toUpdate.childBlockIds = ids;
          });
        });
      }
    }

    if (
      path.length === 4 &&
      path[0] === 'blocksMap' &&
      path[2] === 'childBlockRefs'
    ) {
      const noteBlock = await this.queries.noteBlocksCollection.find(
        patch.path[1] as string
      );

      const ids = this.store.blocksMap[path[1]].childBlockRefs.map(
        ({ current }) => current.$modelId
      );

      if (!isEqual(ids, noteBlock.childBlockIds)) {
        await this.database.action(() => {
          return noteBlock.update((toUpdate) => {
            console.log('update block ');
            toUpdate.childBlockIds = ids;
          });
        });
      }
    }

    if (patch.op === 'add') {
      if (patch.path.length === 2 && patch.path[0] === 'blocksMap') {
        const value: ModelPropsData<NoteBlockModel> & {
          $modelId: string;
        } = patch.value;

        if (value.isPersisted) return;

        await this.database.action(() => {
          return this.queries.noteBlocksCollection.create((creator) => {
            console.log('create block ');
            creator._raw.id = value.$modelId;
            creator.noteId = value.noteRef.id;
            creator.parentBlockId = value.parentBlockRef?.id;
            creator.content = value.content;
            creator.createdAt = new Date(value.createdAt);
          });
        });
      }

      if (patch.path.length === 2 && patch.path[0] === 'notesMap') {
        const value: ModelPropsData<NoteModel> & {
          $modelId: string;
        } = patch.value;

        if (value.isPersisted) return;

        await this.database.action(() => {
          return this.queries.notesCollection.create((creator) => {
            creator._raw.id = value.$modelId;
            creator.dailyNoteDate = new Date(value.dailyNoteDate);
            creator.title = value.title;
            creator.createdAt = new Date(value.createdAt);
          });
        });
      }
    }

    if (patch.op === 'replace') {
      if (patch.path.length === 3 && patch.path[0] === 'blocksMap') {
        const noteBlock = await this.queries.noteBlocksCollection.find(
          patch.path[1] as string
        );

        await this.database.action(async () => {
          if (
            patch.path[2] === 'parentBlockRef' &&
            noteBlock.parentBlockId !== patch.value?.id
          ) {
            await noteBlock.update((toUpdate) => {
              toUpdate.parentBlockId = patch.value?.id;
            });
          }

          if (
            patch.path[2] === 'content' &&
            noteBlock.content !== patch.value
          ) {
            await noteBlock.update((toUpdate) => {
              toUpdate.content = patch.value;
            });
          }
        });
      }

      if (
        patch.path.length === 3 &&
        patch.path[0] === 'notesMap' &&
        patch.path[2] === 'title'
      ) {
        const note = await this.queries.notesCollection.find(
          patch.path[1] as string
        );

        await this.database.action(async () => {
          return note.update((toUpdate) => {
            toUpdate.title = patch.value;
          });
        });
      }

      if (
        patch.path.length === 3 &&
        patch.path[0] === 'notesMap' &&
        patch.path[2] === 'isDeleted' &&
        patch.value === true
      ) {
        const note = await this.queries.notesCollection.find(
          patch.path[1] as string
        );

        await this.database.action(async () => {
          return note.destroyPermanently();
        });
      }
    }

    if (
      patch.path.length >= 3 &&
      patch.path[0] === 'blocksMap' &&
      patch.path[2] === 'linkedNoteRefs'
    ) {
      const noteBlock = await this.queries.noteBlocksCollection.find(
        patch.path[1] as string
      );

      await this.database.action(() =>
        noteBlock.update((toUpdate) => {
          toUpdate.linkedNoteIds = this.store.blocksMap[
            patch.path[1]
          ].linkedNoteRefs.map((ref) => ref.current.$modelId);
        })
      );
    }

    if (
      patch.path.length >= 3 &&
      patch.path[0] === 'notesMap' &&
      patch.path[2] === 'linkedNoteBlockRefs'
    ) {
      const note = await this.queries.notesCollection.find(
        patch.path[1] as string
      );

      await this.database.action(() =>
        note.update((toUpdate) => {
          toUpdate.linkedNoteBlockIds = this.store.notesMap[
            patch.path[1]
          ].linkedNoteBlockRefs.map((ref) => ref.current.$modelId);
        })
      );
    }

    // Don't need to await
  };
}
