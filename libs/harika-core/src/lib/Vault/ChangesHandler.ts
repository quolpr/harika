import { Collection, Database } from '@nozbe/watermelondb';
import { ModelPropsData, Patch } from 'mobx-keystone';
import { NoteBlockModel } from './models/NoteBlockModel';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { NoteRow } from './db/rows/NoteRow';
import { Queries } from './db/Queries';
import { VaultTableNames } from './db/schema';
import { NoteModel } from './models/NoteModel';
import { Subject } from 'rxjs';
import { buffer, concatMap, debounceTime } from 'rxjs/operators';
import { Syncher } from './sync';
import { Vault } from '../Vault';
import { NoteLinkModel } from './models/NoteLinkModel';

export class ChangesHandler {
  notesCollection: Collection<NoteRow>;
  noteBlocksCollection: Collection<NoteBlockRow>;
  patchesSubject: Subject<Patch>;

  constructor(
    private database: Database,
    private queries: Queries,
    private vault: Vault,
    private syncher: Syncher
  ) {
    this.notesCollection = this.database.collections.get<NoteRow>(
      VaultTableNames.NOTES
    );

    this.noteBlocksCollection = this.database.collections.get<NoteBlockRow>(
      VaultTableNames.NOTE_BLOCKS
    );

    this.patchesSubject = new Subject<Patch>();

    this.patchesSubject
      .pipe(
        buffer(this.patchesSubject.pipe(debounceTime(50))),
        concatMap((patches) => this.applyPatches(patches))
      )
      .subscribe();
  }

  handlePatch = (patches: Patch[]) => {
    patches.forEach((patch) => {
      this.patchesSubject.next(patch);
    });
  };

  private applyPatches = async (patches: Patch[]) => {
    await this.database.action(async () => {
      for (let i = 0; i < patches.length; i++) {
        const patch = patches[i];

        if (patch.op === 'add') {
          if (patch.path.length === 2 && patch.path[0] === 'blocksMap') {
            const value: ModelPropsData<NoteBlockModel> & {
              $modelId: string;
            } = patch.value;

            await this.queries.noteBlocksCollection.create((creator) => {
              creator._raw.id = value.$modelId;
              creator.noteId = value.noteRef.id;
              creator.parentBlockId = value.parentBlockRef?.id;
              creator.content = value.content;
              creator.createdAt = new Date(value.createdAt);
              creator.orderPosition = value.orderPosition;
            });
          }

          if (patch.path.length === 2 && patch.path[0] === 'noteLinks') {
            console.log('creating note link!');

            const value: ModelPropsData<NoteLinkModel> & {
              $modelId: string;
            } = patch.value;

            console.log(
              await this.queries.noteLinksCollection.create((creator) => {
                creator._raw.id = value.$modelId;
                creator.noteId = value.noteRef.id;
                creator.noteBlockId = value.noteBlockRef.id;
              })
            );
          }

          if (patch.path.length === 2 && patch.path[0] === 'notesMap') {
            console.log('creating note !');

            const value: ModelPropsData<NoteModel> & {
              $modelId: string;
            } = patch.value;

            await this.queries.notesCollection.create((creator) => {
              creator._raw.id = value.$modelId;
              creator.dailyNoteDate = new Date(value.dailyNoteDate);
              creator.title = value.title;
              creator.createdAt = new Date(value.createdAt);
            });
          }
        }

        if (patch.op === 'replace') {
          if (patch.path.length === 3 && patch.path[0] === 'blocksMap') {
            const noteBlock = await this.queries.noteBlocksCollection.find(
              patch.path[1] as string
            );

            const noteBlockModel = this.vault.blocksMap[patch.path[1]];

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

            if (
              patch.path[2] === 'orderPosition' &&
              noteBlock.orderPosition !== patch.value
            ) {
              await noteBlock.update((toUpdate) => {
                toUpdate.orderPosition = patch.value;
              });
            }
          }

          if (
            patch.path.length === 3 &&
            patch.path[0] === 'notesMap' &&
            patch.path[2] === 'title'
          ) {
            const note = await this.queries.notesCollection.find(
              patch.path[1] as string
            );

            if (patch.value !== note.title) {
              console.log('updating note!');
              await note.update((toUpdate) => {
                toUpdate.title = patch.value;
              });
            }
          }

          if (
            patch.path.length === 3 &&
            patch.path[0] === 'notesMap' &&
            patch.path[2] === 'isDeleted' &&
            patch.value === true
          ) {
            console.log('deleting note');
            const note = await this.queries.notesCollection.find(
              patch.path[1] as string
            );

            await note.destroyPermanently();
          }

          if (
            patch.path.length === 3 &&
            patch.path[0] === 'blocksMap' &&
            patch.path[2] === 'isDeleted' &&
            patch.value === true
          ) {
            console.log('deleting block');
            const noteBlock = await this.queries.noteBlocksCollection.find(
              patch.path[1] as string
            );

            await noteBlock.destroyPermanently();
          }
        }
      }
    });

    this.syncher.sync();
    // Don't need to await
  };
}
