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

export class ChangesHandler {
  notesCollection: Collection<NoteRow>;
  noteBlocksCollection: Collection<NoteBlockRow>;
  subject: Subject<Patch>;

  constructor(
    private database: Database,
    private queries: Queries,
    private store: Store
  ) {
    this.notesCollection = this.database.collections.get<NoteRow>(
      HarikaNotesTableName.NOTES
    );

    this.noteBlocksCollection = this.database.collections.get<NoteBlockRow>(
      HarikaNotesTableName.NOTE_BLOCKS
    );

    this.subject = new Subject<Patch>();

    this.subject.pipe(concatMap((patch) => this.applyPatch(patch))).subscribe();
  }

  handlePatch = (patches: Patch[]) => {
    patches.forEach((patch) => {
      this.subject.next(patch);
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

      await this.database.action(() => {
        return note.update((toUpdate) => {
          toUpdate.childBlockIds = ids;
        });
      });
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

      await this.database.action(() => {
        return noteBlock.update((toUpdate) => {
          toUpdate.childBlockIds = ids;
        });
      });
    }

    if (patch.op === 'add') {
      if (patch.path.length === 2 && patch.path[0] === 'blocksMap') {
        const value: ModelPropsData<NoteBlockModel> & {
          $modelId: string;
        } = patch.value;

        if (value.isPersisted) return;

        await this.database.action(() => {
          return this.queries.noteBlocksCollection.create((creator) => {
            creator._raw.id = value.$modelId;
            creator.noteId = value.noteRef.id;
            creator.parentBlockId = value.parentBlockRef?.id;
            creator.content = value.content;
            creator.createdAt = new Date(value.createdAt);
            creator.updatedAt = new Date(value.updatedAt);
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
            creator.updatedAt = new Date(value.updatedAt);
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
          return noteBlock.update((toUpdate) => {
            if (patch.path[2] === 'parentBlockRef') {
              toUpdate.parentBlockId = patch.value?.id;
            }

            if (patch.path[2] === 'content') {
              toUpdate.content = patch.value;
            }
          });
        });
      }
    }
  };
}
