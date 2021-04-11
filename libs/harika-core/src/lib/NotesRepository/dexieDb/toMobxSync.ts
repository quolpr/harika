import { Observable, OperatorFunction } from 'rxjs';
import { buffer, debounceTime, filter } from 'rxjs/operators';
import { NotesRepository, VaultModel } from '../../NotesRepository';
import {
  convertNoteBlockDocToModelAttrs,
  convertNoteDocToModelAttrs,
} from './convertDocToModel';
import { NoteBlockDocType, NoteDocType, VaultDexieDatabase } from './DexieDb';

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

type ISpecificChangeEvent<
  Name extends string,
  Obj extends Record<string, unknown>
> = {
  key: string;
  //  1=CREATED, 2=UPDATED, 3=DELETED
  type: number;
  source: string;
  // TODO table enum
  table: Name;
  obj: Obj;
};

type INoteChangeEvent = ISpecificChangeEvent<'notes', NoteDocType>;
type INoteBlockChangeEvent = ISpecificChangeEvent<
  'noteBlocks',
  NoteBlockDocType
>;
type IChangeEvent = INoteChangeEvent | INoteBlockChangeEvent;

export const toMobxSync = (
  db: VaultDexieDatabase,
  noteRepository: NotesRepository,
  vault: VaultModel
) => {
  const db$ = new Observable<IChangeEvent>((observer) => {
    const subscriber = (chs: IChangeEvent[]) => {
      chs.forEach((ch) => {
        observer.next(ch);
      });
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    db.on('changes', subscriber);

    return () => {
      db.on('changes').unsubscribe(subscriber);
    };
  });

  db$
    .pipe(
      filter((ch) => ch.source !== db.windowId),
      bufferDebounce(1000)
    )
    .subscribe((evs) => {
      const notes = (() => {
        const noteEvents = evs.filter(
          (ev) => ev.table === 'notes'
        ) as INoteChangeEvent[];

        const latestDedupedEvents: Record<string, INoteChangeEvent> = {};

        noteEvents.forEach((ev) => {
          if (!latestDedupedEvents[ev.obj.shortId]) {
            latestDedupedEvents[ev.obj.shortId] = ev;
          }
        });

        return Object.values(latestDedupedEvents).map((ev) => {
          const note = vault.notesMap[ev.obj.shortId];

          return convertNoteDocToModelAttrs(
            ev.obj,
            Boolean(note?.areChildrenLoaded),
            Boolean(note?.areLinksLoaded)
          );
        });
      })();

      const blocks = (() => {
        const blockEvents = evs.filter(
          (ev) => ev.table === 'noteBlocks'
        ) as INoteBlockChangeEvent[];

        const latestDedupedEvents: Record<string, INoteBlockChangeEvent> = {};

        blockEvents.forEach((ev) => {
          if (!latestDedupedEvents[ev.obj.shortId]) {
            latestDedupedEvents[ev.obj.shortId] = ev;
          }
        });

        return Object.values(latestDedupedEvents).map((ev) =>
          convertNoteBlockDocToModelAttrs(ev.obj)
        );
      })();

      vault.createOrUpdateEntitiesFromAttrs(notes, blocks);
    });
};
