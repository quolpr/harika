import React, { MutableRefObject, useCallback } from 'react';
import { isEqual } from 'lodash-es';
import { useState } from 'react';
import { timer } from 'rxjs';
import { debounce, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { useNotesService } from '../../../../contexts/CurrentNotesServiceContext';
import { cn } from '../../../../utils';
import './styles.css';
import { useObservable, useObservableState } from 'observable-hooks';
import { Pos } from 'caret-pos';
import {
  EditorDropdown,
  editorDropdownClass,
  IDropdownItem,
} from '../../../EditorDropdown/EditorDropdown';

export type SearchedNote = { id: string; title: string };
export const noteAutocompleteClass = cn('note-autocomplete');

export const NoteTitleAutocomplete = React.memo(
  ({
    value,
    onSelect,
    caretPos,
    holderRef,
  }: {
    value: string | undefined;
    onSelect: (res: SearchedNote) => void;
    caretPos: Pos | undefined;
    holderRef: MutableRefObject<HTMLDivElement | null>;
  }) => {
    const notesService = useNotesService();

    const [wasFirstSearchHappened, setWasFirstSearchHappened] = useState(false);

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

    return (
      <>
        {value && (
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
                  <li className={editorDropdownClass('item')}>
                    No notes found
                  </li>
                )}
              </>
            }
          />
        )}
      </>
    );
  },
);
