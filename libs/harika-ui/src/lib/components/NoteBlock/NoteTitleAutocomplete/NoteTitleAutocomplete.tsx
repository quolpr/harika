import { isEqual } from 'lodash-es';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BehaviorSubject, combineLatest, timer } from 'rxjs';
import {
  debounce,
  distinctUntilChanged,
  filter,
  map,
  tap,
} from 'rxjs/operators';
import { useNoteRepository } from '../../../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../../../hooks/useCurrentVault';
import { cn } from '../../../utils';
import './styles.css';

type SearchedNote = { id: string; title: string };

const noteAutocompleteClass = cn('note-autocomplete');

export const NoteTitleAutocomplete = React.memo(
  ({ value }: { value: string | undefined }) => {
    const vault = useCurrentVault();
    const noteRepo = useNoteRepository();

    const [searchResults, setSearchResult] = useState<SearchedNote[]>([]);

    const subject = useMemo(
      () => new BehaviorSubject<string | undefined>(undefined),
      []
    );

    useEffect(() => {
      const sub = combineLatest([
        subject.pipe(
          distinctUntilChanged(),
          debounce(() => timer(100))
        ),
        noteRepo.getAllNotesTuples$(vault.$modelId),
      ])
        .pipe(
          tap(([val]) => {
            if (val === undefined && setSearchResult.length !== 0) {
              setSearchResult([]);
            }
          }),
          filter(([val]) => val !== undefined),
          map((res) => res as [string, SearchedNote[]]),
          map(([val, tuples]) =>
            tuples.filter(({ title }) =>
              title.toLowerCase().includes(val.toLowerCase())
            )
          ),
          distinctUntilChanged(isEqual)
        )
        .subscribe((res) => {
          setSearchResult(res);
        });

      return () => sub.unsubscribe();
    }, [noteRepo, subject, vault.$modelId]);

    useEffect(() => {
      subject.next(value);
    }, [subject, value]);

    return (
      // eslint-disable-next-line react/jsx-no-useless-fragment
      <>
        {value && (
          <ul className={noteAutocompleteClass()}>
            {searchResults.length === 0 && <li>No notes found</li>}
            {searchResults.map(({ id, title }) => (
              <li key={id} className={noteAutocompleteClass('item')}>
                <div className={noteAutocompleteClass('content')}>{title}</div>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
);
