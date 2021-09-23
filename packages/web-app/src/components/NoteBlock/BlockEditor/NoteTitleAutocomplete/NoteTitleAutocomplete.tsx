import React, { MutableRefObject, useRef } from 'react';
import { isEqual } from 'lodash-es';
import { useEffect, useState } from 'react';
import { timer } from 'rxjs';
import { debounce, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { useNotesService } from '../../../../contexts/CurrentNotesServiceContext';
import { cn } from '../../../../utils';
import scrollIntoView from 'scroll-into-view-if-needed';
import './styles.css';
import { useObservable, useObservableState } from 'observable-hooks';
import { Pos } from 'caret-pos';
import useResizeObserver from 'use-resize-observer/polyfilled';

export type SearchedNote = { id: string; title: string };
export const noteAutocompleteClass = cn('note-autocomplete');

export const NoteTitleAutocomplete = React.memo(
  ({
    value,
    onSelect,
    caretPos,
    wrapperRef,
  }: {
    value: string | undefined;
    onSelect: (res: SearchedNote) => void;
    caretPos: Pos | undefined;
    wrapperRef: MutableRefObject<HTMLDivElement | null>;
  }) => {
    const notesService = useNotesService();

    const mainElRef = useRef<HTMLDivElement | null>(null);
    const containerElRef = useRef<HTMLDivElement | null>(null);

    const [wasFirstSearchHappened, setWasFirstSearchHappened] = useState(false);
    const [focusedIdx, setFocusedIdx] = useState<number>(0);
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
      if (searchResults.length > 0 && focusedIdx >= searchResults.length) {
        const newIndex = searchResults.length - 1;

        setFocusedIdx(newIndex);
      }
    }, [focusedIdx, searchResults]);

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const isSearchPresent = searchResults.length !== 0;

        const handleNewIndexSet = (newIndex: number) => {
          setFocusedIdx(newIndex);

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
              focusedIdx + 1 >= searchResults.length ? 0 : focusedIdx + 1;

            handleNewIndexSet(newIndex);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();

            const newIndex =
              focusedIdx - 1 > 0 ? focusedIdx - 1 : searchResults.length - 1;

            handleNewIndexSet(newIndex);
          }
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
          if (value !== undefined) {
            e.preventDefault();

            if (isSearchPresent) {
              onSelect(searchResults[focusedIdx]);
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
    }, [focusedIdx, onSelect, searchResults, value]);

    const { width: containerWidth = 0 } = useResizeObserver<HTMLDivElement>({
      ref: containerElRef,
    });
    const { width: wrapperWidth = 0 } = useResizeObserver<HTMLDivElement>({
      ref: wrapperRef,
    });
    const [containerLeftPos, setContainerLeftPos] = useState(0);

    useEffect(() => {
      if (!mainElRef.current || !containerElRef.current || !caretPos) return;

      if (caretPos.left + containerWidth > wrapperWidth) {
        setContainerLeftPos(wrapperWidth - containerWidth);
      } else {
        setContainerLeftPos(caretPos.left);
      }
    }, [caretPos, containerWidth, wrapperWidth]);

    return (
      <>
        {value && (
          <div className={noteAutocompleteClass()} ref={mainElRef}>
            <div
              className={noteAutocompleteClass('container')}
              style={{
                transform: `translateX(${containerLeftPos}px) translateY(${
                  (caretPos?.top || 0) + (caretPos?.height || 0)
                }px)`,
              }}
              ref={containerElRef}
            >
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
                      focused: focusedIdx === i,
                    })}
                    onMouseEnter={() => setFocusedIdx(i)}
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
          </div>
        )}
      </>
    );
  },
);
