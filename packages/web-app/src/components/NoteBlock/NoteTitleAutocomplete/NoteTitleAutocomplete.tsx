import React, { useRef } from 'react';
import { isEqual } from 'lodash-es';
import { useEffect, useMemo, useState } from 'react';
import { BehaviorSubject, combineLatest, timer } from 'rxjs';
import {
  debounce,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';
import { useNotesService } from '../../../contexts/CurrentNotesServiceContext';
import { cn } from '../../../utils';
import scrollIntoView from 'scroll-into-view-if-needed';
import './styles.css';
import { useObservable, useObservableState } from 'observable-hooks';

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
    const notesService = useNotesService();

    const [wasFirstSearchHappened, setWasFirstSearchHappened] = useState(false);
    const [focusedId, setFocusedId] = useState<string | undefined>(undefined);
    const itemsRef = useRef<Array<HTMLElement | null>>([]);

    const searchResult$ = useObservable(
      ($inputs) => {
        return $inputs.pipe(
          distinctUntilChanged((a, b) => isEqual(a, b)),
          debounce(() => timer(100)),
          switchMap(([notesService, text]) =>
            text ? notesService.searchNotesTuples$(text) : [],
          ),
          distinctUntilChanged((a, b) => isEqual(a, b)),
          tap(() => {
            setWasFirstSearchHappened(true);
          }),
        );
      },
      [notesService, value],
    );

    const searchResults = useObservableState(searchResult$, []);
    const resultLength = searchResults.length;
    useEffect(() => {
      itemsRef.current = itemsRef.current.slice(0, resultLength);
    }, [resultLength]);

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
            <ul className={noteAutocompleteClass('content')} role="menu">
              {!wasFirstSearchHappened && (
                <li className={noteAutocompleteClass('item')}>Loading...</li>
              )}
              {wasFirstSearchHappened && searchResults.length === 0 && (
                <li className={noteAutocompleteClass('item')}>
                  No notes found
                </li>
              )}
              {searchResults.map((res, i) => (
                // Already handling
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  role="menuitem"
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
