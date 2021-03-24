import { ModelPropsData, Patch } from 'mobx-keystone';
import { Subject } from 'rxjs';
import { buffer, concatMap, debounceTime, tap } from 'rxjs/operators';
import { Vault } from '../../NoteRepository';
import { NoteBlockModel } from '../models/NoteBlockModel';
import { NoteLinkModel } from '../models/NoteLinkModel';
import { NoteModel } from '../models/NoteModel';
import { HarikaRxDatabase } from './initDb';

export class RxdbChangesHandler {
  patchesSubject: Subject<Patch>;

  constructor(
    private database: HarikaRxDatabase,
    private vault: Vault,
    onPatchesApplied?: () => void
  ) {
    this.patchesSubject = new Subject<Patch>();

    this.patchesSubject
      .pipe(
        buffer(this.patchesSubject.pipe(debounceTime(50))),
        concatMap((patches) => this.applyPatches(patches)),
        tap(() => onPatchesApplied?.())
      )
      .subscribe();
  }

  handlePatch = (patches: Patch[]) => {
    patches.forEach((patch) => {
      this.patchesSubject.next(patch);
    });
  };

  private applyPatches = async (patches: Patch[]) => {
    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];

      if (patch.op === 'add') {
        if (patch.path.length === 2 && patch.path[0] === 'blocksMap') {
          const value: ModelPropsData<NoteBlockModel> & {
            $modelId: string;
          } = patch.value;

          await this.database.noteblocks.insert({
            _id: value.$modelId,
            noteId: value.noteRef.id,
            parentBlockId: value.parentBlockRef?.id,
            content: value.content,
            createdAt: value.createdAt,
            orderPosition: value.orderPosition,
          });
        }

        if (patch.path.length === 2 && patch.path[0] === 'noteLinks') {
          console.log('creating note link!');

          const value: ModelPropsData<NoteLinkModel> & {
            $modelId: string;
          } = patch.value;

          await this.database.notelinks.insert({
            _id: value.$modelId,
            noteId: value.noteRef.id,
            noteBlockId: value.noteBlockRef.id,
            createdAt: Date.now(),
          });
        }

        if (patch.path.length === 2 && patch.path[0] === 'notesMap') {
          console.log('creating note !');

          const value: ModelPropsData<NoteModel> & {
            $modelId: string;
          } = patch.value;

          await this.database.notes.insert({
            _id: value.$modelId,
            dailyNoteDate: value.dailyNoteDate,
            title: value.title,
            createdAt: value.createdAt,
          });
        }
      }

      if (patch.op === 'replace') {
        if (patch.path.length === 3 && patch.path[0] === 'blocksMap') {
          const noteBlock = await this.database.noteblocks
            .findOne({
              selector: { _id: patch.path[1] },
            })
            .exec();

          if (!noteBlock) {
            console.error(`Failed to find noteblock with id ${patch.path[1]}`);
            continue;
          }

          if (
            patch.path[2] === 'parentBlockRef' &&
            noteBlock.parentBlockId !== patch.value?.id
          ) {
            await noteBlock.atomicPatch({ parentBlockId: patch.value?.id });
          }

          if (
            patch.path[2] === 'content' &&
            noteBlock.content !== patch.value
          ) {
            await noteBlock.atomicPatch({
              content: patch.value,
            });
          }

          if (
            patch.path[2] === 'orderPosition' &&
            noteBlock.orderPosition !== patch.value
          ) {
            await noteBlock.atomicPatch({
              orderPosition: patch.value,
            });
          }
        }

        if (
          patch.path.length === 3 &&
          patch.path[0] === 'notesMap' &&
          patch.path[2] === 'title'
        ) {
          const note = await this.database.notes
            .findOne({
              selector: { _id: patch.path[1] },
            })
            .exec();

          if (!note) {
            console.error(`Failed to find note with id ${patch.path[1]}`);
            continue;
          }

          if (patch.value !== note.title) {
            console.log('updating note!');

            await note.atomicPatch({
              title: patch.value,
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

          const note = await this.database.notes
            .findOne({
              selector: { id: patch.path[1] },
            })
            .exec();

          if (!note) {
            console.error(`Failed to find note with id ${patch.path[1]}`);
            continue;
          }

          note.remove();
        }

        if (
          patch.path.length === 3 &&
          patch.path[0] === 'blocksMap' &&
          patch.path[2] === 'isDeleted' &&
          patch.value === true
        ) {
          const noteBlock = await this.database.noteblocks
            .findOne({
              selector: { _id: patch.path[1] },
            })
            .exec();

          if (!noteBlock) {
            console.error(`Failed to find noteblock with id ${patch.path[1]}`);
            continue;
          }

          noteBlock.remove();
        }

        if (
          patch.path.length === 3 &&
          patch.path[0] === 'noteLinks' &&
          patch.path[2] === 'isDeleted' &&
          patch.value === true
        ) {
          console.log('deleting note link');

          const noteLink = await this.database.notelinks
            .findOne({
              selector: { _id: patch.path[1] },
            })
            .exec();

          if (!noteLink) {
            console.error(`Failed to find notelink with id ${patch.path[1]}`);
            continue;
          }

          noteLink.remove();
        }
      }
    }
    console.log('RxPatches', patches);
  };
}
