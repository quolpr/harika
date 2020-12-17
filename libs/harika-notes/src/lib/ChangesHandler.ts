import { Collection, Database } from '@nozbe/watermelondb';
import { ModelPropsData, Patch } from 'mobx-keystone';
import { NoteBlockMemModel } from './models/NoteBlockMemModel';
import { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
import { NoteDbModel } from './PersistentDb/models/NoteDbModel';
import { Queries } from './PersistentDb/Queries';
import { HarikaNotesTableName } from './PersistentDb/schema';

export class ChangesHandler {
  notesCollection: Collection<NoteDbModel>;
  noteBlocksCollection: Collection<NoteBlockDbModel>;
  constructor(private database: Database, private queries: Queries) {
    this.notesCollection = this.database.collections.get<NoteDbModel>(
      HarikaNotesTableName.NOTES
    );

    this.noteBlocksCollection = this.database.collections.get<NoteBlockDbModel>(
      HarikaNotesTableName.NOTE_BLOCKS
    );
  }

  handlePatch = (patches: Patch[]) => {
    patches.forEach(async (patch) => {
      if (patch.op === 'add') {
        if (patch.path.length === 2 && patch.path[0] === 'blocksMap') {
          const value: ModelPropsData<NoteBlockMemModel> & {
            $modelId: string;
          } = patch.value;

          if (value.isPersisted) return;

          this.database.action(() => {
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
      }

      if (patch.op === 'replace') {
        if (patch.path.length === 3 && patch.path[0] === 'blocksMap') {
          const noteBlock = await this.queries.noteBlocksCollection.find(
            patch.path[1] as string
          );

          this.database.action(async () => {
            return noteBlock.update((toUpdate) => {
              if (patch.path[2] === 'parentBlockRef') {
                toUpdate.parentBlockId = patch.value.id;
              }

              if (patch.path[2] === 'content') {
                toUpdate.content = patch.value;
              }
            });
          });
        }
      }
    });
  };
}
