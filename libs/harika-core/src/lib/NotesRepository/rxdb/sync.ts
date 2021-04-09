import { RxChangeEvent } from 'rxdb';
import { Observable, OperatorFunction, Subject, timer } from 'rxjs';
import { buffer, debounceTime } from 'rxjs/operators';
import { NotesRepository, VaultModel } from '../../NotesRepository';
import {
  convertNoteBlockRowToModelAttrs,
  simpleConvertNoteDbToModelAttrsSync,
} from '../convertRowToModel';
import { VaultDatabaseCollections } from './collectionTypes';
import { VaultRxDatabase } from './initDb';
import { NoteBlockDocument } from './NoteBlockDoc';
import { NoteDocument } from './NoteDoc';

type BufferDebounce = <T>(debounce: number) => OperatorFunction<T, T[]>;
const bufferDebounce: BufferDebounce = (debounce) => (source) =>
  new Observable((observer) =>
    source.pipe(buffer(source.pipe(debounceTime(debounce)))).subscribe({
      next(x) {
        observer.next(x);
      },
      error(err) {
        observer.error(err);
      },
      complete() {
        observer.complete();
      },
    })
  );

export const initRxDbToLocalSync = (
  db: VaultRxDatabase,
  noteRepository: NotesRepository,
  vault: VaultModel
) => {
  db.$.pipe(bufferDebounce(1000)).subscribe(
    (events: RxChangeEvent<NoteDocument | NoteBlockDocument>[]) => {
      // When rxDocument is not present - it means event came from remote DB
      // When token are not the same - it means event came from the neighbor table
      // Otherwise - it came from mobx-keystone, and we don't need to apply such changes

      const remoteEvents = events
        .filter((ev) => ev.databaseToken !== db.token || !ev.rxDocument)
        .reverse();

      const notes = (() => {
        const noteEvents = remoteEvents.filter(
          (ev) => ev.collectionName === VaultDatabaseCollections.NOTES
        ) as RxChangeEvent<NoteDocument>[];

        const latestDedupedEvents: Record<
          string,
          RxChangeEvent<NoteDocument>
        > = {};

        noteEvents.forEach((ev) => {
          if (!latestDedupedEvents[ev.documentData._id]) {
            latestDedupedEvents[ev.documentData._id] = ev;
          }
        });

        return Object.values(latestDedupedEvents).map((ev) => {
          const note = vault.notesMap[ev.documentData._id];

          return simpleConvertNoteDbToModelAttrsSync(
            ev.documentData,
            Boolean(note?.areChildrenLoaded),
            Boolean(note?.areLinksLoaded)
          );
        });
      })();

      const blocks = (() => {
        const blockEvents = remoteEvents.filter(
          (ev) => ev.collectionName === VaultDatabaseCollections.NOTE_BLOCKS
        ) as RxChangeEvent<NoteBlockDocument>[];

        const latestDedupedEvents: Record<
          string,
          RxChangeEvent<NoteBlockDocument>
        > = {};

        blockEvents.forEach((ev) => {
          if (!latestDedupedEvents[ev.documentData._id]) {
            latestDedupedEvents[ev.documentData._id] = ev;
          }
        });

        return Object.values(latestDedupedEvents).map((ev) =>
          convertNoteBlockRowToModelAttrs(ev.documentData)
        );
      })();
      console.log('sync!', events);

      vault.createOrUpdateEntitiesFromAttrs(notes, blocks);
    }
  );
};
