import React, { useRef } from 'react';
import { isEqual } from 'lodash-es';
import { useEffect, useMemo, useState } from 'react';
import { BehaviorSubject, combineLatest, timer } from 'rxjs';
import { debounce, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { useNoteRepository } from '../../../contexts/CurrentNoteRepositoryContext';
import { cn } from '../../../utils';
import scrollIntoView from 'scroll-into-view-if-needed';
import './styles.css';

export type SearchedNote = { id: string; title: string };

export const noteAutocompleteClass = cn('note-autocomplete');

export const NoteTitleAutocomplete = React.memo(
  ({
    value,
    onSelect,
  }: {
    value: string | undefined;
    onSelect: (res: SearchedNote) => void;
  }) => {
    const noteRepo = useNoteRepository();

    const [wasFirstSearchHappened, setWasFirstSearchHappened] = useState(false);

    const [searchResults, setSearchResult] = useState<SearchedNote[]>([]);

    const [focusedId, setFocusedId] = useState<string | undefined>(undefined);

    const subject = useMemo(
      () => new BehaviorSubject<string | undefined>(undefined),
      [],
    );

    const itemsRef = useRef<Array<HTMLElement | null>>([]);
    const resultLength = searchResults.length;
    useEffect(() => {
      itemsRef.current = itemsRef.current.slice(0, resultLength);
    }, [resultLength]);

    useEffect(() => {
      const sub = combineLatest([
        subject.pipe(
          distinctUntilChanged(),
          debounce(() => timer(100)),
        ),
        noteRepo.getAllNotesTuples$(),
      ])
        .pipe(
          filter(([val]) => val !== undefined),
          map((res) => res as [string, SearchedNote[]]),
          map(([val, tuples]) =>
            tuples.filter(({ title }) =>
              title.toLowerCase().includes(val.toLowerCase()),
            ),
          ),
          distinctUntilChanged(isEqual),
        )
        .subscribe((res) => {
          setSearchResult(res);
          setWasFirstSearchHappened(true);
        });

      return () => sub.unsubscribe();
    }, [noteRepo, subject]);

    useEffect(() => {
      subject.next(value);
    }, [subject, value]);

    useEffect(() => {
      if (!searchResults.find(({ id }) => id === focusedId)) {
        setFocusedId(searchResults[0]?.id);
      }
    }, [focusedId, searchResults]);

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const ids = searchResults.map(({ id }) => id);
        const currentIdIndex =
          focusedId === undefined ? -1 : ids.indexOf(focusedId);

        const isSearchPresent = currentIdIndex !== -1 && ids.length !== 0;

        const handleNewIndexSet = (newIndex: number) => {
          setFocusedId(ids[newIndex]);

          const itemEl = itemsRef.current[newIndex];
          if (itemEl) {
            scrollIntoView(itemEl, {
              behavior: 'smooth',
              scrollMode: 'if-needed',
            });
          }
        };

        if (isSearchPresent) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();

            const newIndex =
              ids[currentIdIndex + 1] !== undefined ? currentIdIndex + 1 : 0;

            handleNewIndexSet(newIndex);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();

            const newIndex =
              ids[currentIdIndex - 1] !== undefined
                ? currentIdIndex - 1
                : ids.length - 1;

            handleNewIndexSet(newIndex);
          }
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
          if (value !== undefined) {
            e.preventDefault();

            if (isSearchPresent) {
              onSelect(searchResults[currentIdIndex]);
            } else {
              onSelect({ id: '123', title: value });
            }
          }
        }
      };

      document.addEventListener('keydown', onKeyDown);

      return () => {
        document.removeEventListener('keydown', onKeyDown);
      };
    }, [focusedId, onSelect, searchResults, value]);

    return (
      <div style={{ position: 'relative' }}>
        {value && (
          <div className={noteAutocompleteClass()}>
            <ul className={noteAutocompleteClass('content')}>
              {!wasFirstSearchHappened && (
                <li className={noteAutocompleteClass('item')}>Loading...</li>
              )}
              {wasFirstSearchHappened && searchResults.length === 0 && (
                <li className={noteAutocompleteClass('item')}>
                  No notes found
                </li>
              )}
              {searchResults.map((res, i) => (
                <li
                  key={res.id}
                  className={noteAutocompleteClass('item', {
                    focused: focusedId === res.id,
                  })}
                  onMouseEnter={() => setFocusedId(res.id)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    onSelect(res);
                  }}
                  // Don't trigger blur
                  onMouseDown={(e) => e.preventDefault()}
                  ref={(el) => (itemsRef.current[i] = el)}
                >
                  <div className={noteAutocompleteClass('item-content')}>
                    {res.title}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  },
);
