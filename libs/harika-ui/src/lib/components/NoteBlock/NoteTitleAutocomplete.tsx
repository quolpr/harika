import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  BehaviorSubject,
  combineLatest,
  OperatorFunction,
  Subject,
  timer,
} from 'rxjs';
import { debounce, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';

type SearchedNote = { id: string; title: string };

export const NoteTitleAutocomplete = ({
  value,
}: {
  value: string | undefined;
}) => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();

  const [searchResults, setSearchResult] = useState<SearchedNote[]>([]);

  const subject = useMemo(
    () => new BehaviorSubject<string | undefined>(undefined),
    []
  );

  useEffect(() => {
    return combineLatest([
      subject.pipe(
        distinctUntilChanged(),
        debounce(() => timer(100))
      ),
      noteRepo.getAllNotesTuples$(vault.$modelId),
    ])
      .pipe(
        filter(([val]) => val !== undefined),
        map((res) => res as [string, SearchedNote[]]),
        map(([val, tuples]) =>
          tuples.filter(({ title }) =>
            title.toLowerCase().includes(val.toLowerCase())
          )
        )
      )
      .subscribe((res) => {
        setSearchResult(res);
      }).unsubscribe;
  }, [noteRepo, subject, vault.$modelId]);

  useEffect(() => {
    subject.next(value);
  }, [subject, value]);

  return (
    <ul style={{ position: 'absolute' }}>
      {searchResults.map(({ id, title }) => (
        <li key={id}>{title}</li>
      ))}
    </ul>
  );
};
