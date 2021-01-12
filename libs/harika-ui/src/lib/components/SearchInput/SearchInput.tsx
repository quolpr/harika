import { useCurrentVault } from '@harika/harika-utils';
import clsx from 'clsx';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import './styles.css';

export interface IFocusBlockState {
  focusOnBlockId: string;
}

export const SearchInput = ({ className }: { className?: string }) => {
  const vault = useCurrentVault();
  const history = useHistory<IFocusBlockState>();

  const [value, setValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  return (
    <div
      className={clsx(className, 'search-input', {
        'search-input--focused': isInputFocused,
      })}
    >
      <input
        className="search-input__input"
        onChange={(e) => setValue(e.target.value)}
        value={value}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            const note = vault.createNote({ title: value });

            history.push(`/notes/${note.$modelId}`, {
              focusOnBlockId: note.children[0].$modelId,
            });

            setValue('');
          }
        }}
        onBlur={() => setIsInputFocused(false)}
        onFocus={() => setIsInputFocused(true)}
      />
      <div style={{ position: 'relative' }}>
        <div
          className={clsx('search-input__result', {
            'search-input__result--opened': isInputFocused,
          })}
        >
          <div className="search-input__create">Create note: {value}</div>
        </div>
      </div>
    </div>
  );
};
