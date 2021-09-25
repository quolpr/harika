import { Pos } from 'caret-pos';
import { isEqual } from 'lodash-es';
import { useObservable, useObservableState } from 'observable-hooks';
import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  distinctUntilChanged,
  timer,
  switchMap,
  debounce,
  tap,
  map,
} from 'rxjs';
import { useNotesService } from '../../../../contexts/CurrentNotesServiceContext';
import {
  IDropdownItem,
  editorDropdownClass,
  EditorDropdown,
} from '../EditorDropdown/EditorDropdown';
import { SearchedNote } from '../NoteTitleAutocomplete/NoteTitleAutocomplete';

// TODO: The logic is the same as with note search. Maybe we could refactor
export const FindBlockDropdown = ({
  value,
  onSelect,
  caretPos,
  holderRef,
  isShownRef,
}: {
  value: string | undefined;
  onSelect: (res: SearchedNote) => void;
  caretPos: Pos | undefined;
  holderRef: MutableRefObject<HTMLDivElement | null>;
  isShownRef: MutableRefObject<boolean>;
}) => {
  const notesService = useNotesService();

  const [wasFirstSearchHappened, setWasFirstSearchHappened] = useState(false);

  const searchResult$ = useObservable(
    ($inputs) => {
      return $inputs.pipe(
        distinctUntilChanged((a, b) => isEqual(a, b)),
        debounce(() => timer(100)),
        switchMap(([notesService, text]) =>
          text ? notesService.searchBlocksTuples$(text) : [],
        ),
        map((tuples) => tuples.map((t) => ({ title: t.content, id: t.id }))),
        tap(() => {
          setWasFirstSearchHappened(true);
        }),
      );
    },
    [notesService, value],
  );

  const searchResults = useObservableState(searchResult$, []);

  const handleClick = useCallback(
    (item: IDropdownItem) => {
      onSelect(item);
    },
    [onSelect],
  );

  const handleTabOrEnterPress = useCallback(
    (e, item) => {
      if (value !== undefined) {
        e.preventDefault();

        if (item) {
          onSelect(item);
        } else {
          onSelect({ id: '123', title: value });
        }
      }
    },
    [onSelect, value],
  );

  useEffect(() => {
    return () => {
      isShownRef.current = false;
    };
  }, [isShownRef]);

  isShownRef.current = value !== undefined;
  return (
    <>
      {isShownRef.current && (
        <EditorDropdown
          items={searchResults}
          holderRef={holderRef}
          onClick={handleClick}
          onTabOrEnterPress={handleTabOrEnterPress}
          caretPos={caretPos}
          onEmpty={
            <>
              {!wasFirstSearchHappened && (
                <li className={editorDropdownClass('item')}>Loading...</li>
              )}
              {wasFirstSearchHappened && searchResults.length === 0 && (
                <li className={editorDropdownClass('item')}>No blocks found</li>
              )}
            </>
          }
        />
      )}
    </>
  );
};
