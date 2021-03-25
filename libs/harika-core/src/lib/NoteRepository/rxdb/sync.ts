import { RxChangeEvent } from 'rxdb';
import { Observable, OperatorFunction, Subject, timer } from 'rxjs';
import { buffer, debounce, debounceTime } from 'rxjs/operators';
import { NoteRepository, Vault } from '../../NoteRepository';
import {
  convertNoteBlockRowToModelAttrs,
  simpleConvertNoteDbToModelAttrsSync,
} from '../convertRowToModel';
import { HarikaRxDatabase } from './initDb';
import { NoteBlockDocument } from './NoteBlockRx';
import { NoteDocument } from './NoteRx';

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

// TODO: general debouncer

export const initRxDbToLocalSync = (
  db: HarikaRxDatabase,
  noteRepository: NoteRepository,
  vault: Vault
) => {
  db.noteblocks.$.pipe(bufferDebounce(1000)).subscribe(
    (events: RxChangeEvent<NoteBlockDocument>[]) => {
      const remoteEvents = events
        .filter((ev) => ev.databaseToken !== db.token)
        .reverse();

      const latestDedupedEvents: Record<
        string,
        RxChangeEvent<NoteBlockDocument>
      > = {};

      remoteEvents.forEach((ev) => {
        if (!latestDedupedEvents[ev.documentData._id]) {
          latestDedupedEvents[ev.documentData._id] = ev;
        }
      });

      vault.createOrUpdateEntitiesFromAttrs(
        [],
        Object.values(latestDedupedEvents).map((ev) =>
          convertNoteBlockRowToModelAttrs(ev.documentData)
        ),
        []
      );
    }
  );

  db.notes.$.pipe(bufferDebounce(1000)).subscribe(
    (events: RxChangeEvent<NoteDocument>[]) => {
      console.log('hey!', events);

      const remoteEvents = events
        .filter((ev) => ev.databaseToken !== db.token)
        .reverse();

      const latestDedupedEvents: Record<
        string,
        RxChangeEvent<NoteDocument>
      > = {};

      remoteEvents.forEach((ev) => {
        if (!latestDedupedEvents[ev.documentData._id]) {
          latestDedupedEvents[ev.documentData._id] = ev;
        }
      });

      vault.createOrUpdateEntitiesFromAttrs(
        Object.values(latestDedupedEvents).map((ev) => {
          const note = vault.notesMap[ev.documentData._id];
          console.log('converted1');

          return simpleConvertNoteDbToModelAttrsSync(
            ev.documentData,
            note.areChildrenLoaded,
            note.areLinksLoaded
          );
        }),
        [],
        []
      );
    }
  );
};
