import React, { useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import './styles.css';
import { Search as SearchIcon } from 'heroicons-react';
import { useCurrentVault } from '@harika/harika-utils';
import Highlighter from 'react-highlight-words';
import { Link, useHistory } from 'react-router-dom';
import { cn } from '../../utils';
import { useKey } from 'react-use';

const searchModalClass = cn('search-modal');

export const SearchModal = ({
  isOpened,
  onClose,
}: {
  isOpened: boolean;
  onClose: () => void;
}) => {
  const history = useHistory();
  const vault = useCurrentVault();
  const [searchValue, setSearchValue] = useState('');
  const [focusedId, setFocusedId] = useState<undefined | string>(undefined);
  const [foundNotes, setFoundNotes] = useState<{ title: string; id: string }[]>(
    []
  );

  const searchItemRefs = useRef<Record<string, HTMLAnchorElement>>({});

  useKey(
    'ArrowDown',
    () => {
      const i = foundNotes.findIndex((n) => n.id === focusedId);

      if (i === -1 || i === foundNotes.length - 1) {
        setFocusedId(foundNotes[0]?.id);
      } else {
        setFocusedId(foundNotes[i + 1].id);
      }
    },
    undefined,
    [foundNotes, focusedId]
  );

  useKey(
    'ArrowUp',
    () => {
      const i = foundNotes.findIndex((n) => n.id === focusedId);

      if (i === -1) return;

      if (i === 0) {
        setFocusedId(foundNotes[foundNotes.length - 1]?.id);
      } else {
        setFocusedId(foundNotes[i - 1].id);
      }
    },
    undefined,
    [foundNotes, focusedId]
  );

  useKey(
    'Enter',
    () => {
      if (focusedId) {
        history.push(`/notes/${focusedId}`);
        onClose();
      }
    },
    undefined,
    [focusedId, onClose]
  );

  // TODO RXjs
  useEffect(() => {
    const cb = async () => {
      const notes = await vault.searchNotes(searchValue);
      setFoundNotes(notes);

      if (notes[0]) {
        setFocusedId(notes[0].id);
      } else {
        setFocusedId(undefined);
      }
    };

    cb();
  }, [searchValue, vault]);

  useEffect(() => {
    if (focusedId && searchItemRefs.current[focusedId]) {
      searchItemRefs.current[focusedId].scrollIntoView({ block: 'nearest' });
    }
  }, [focusedId]);

  return (
    <Modal
      isOpen={isOpened}
      style={{ overlay: { zIndex: 110 }, content: {} }}
      overlayClassName="ReactModal__Overlay"
      className="ReactModal__Content"
      shouldCloseOnOverlayClick={true}
      onRequestClose={onClose}
    >
      <header className={searchModalClass('header')}>
        <form
          action=""
          role="search"
          className={searchModalClass('form')}
          onSubmit={(e) => e.preventDefault()}
        >
          <SearchIcon className={searchModalClass('search-icon')} />
          <input
            className={searchModalClass('search-input')}
            type="search"
            aria-autocomplete="list"
            ref={(el) => {
              if (el) {
                el.focus();
              }
            }}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
                e.preventDefault();
            }}
          />
        </form>
      </header>
      <div className={searchModalClass('search-result-container')}>
        <div className={searchModalClass('search-result')}>
          {foundNotes.map((foundNote) => {
            return (
              <Link
                key={foundNote.id}
                to={`/notes/${foundNote.id}`}
                className={searchModalClass('search-item', {
                  focused: foundNote.id === focusedId,
                })}
                onClick={onClose}
                onMouseEnter={() => {
                  setFocusedId(foundNote.id);
                }}
                ref={(el) => {
                  if (el) {
                    searchItemRefs.current[foundNote.id] = el;
                  } else {
                    delete searchItemRefs.current[foundNote.id];
                  }
                }}
              >
                <Highlighter
                  searchWords={[searchValue]}
                  autoEscape={true}
                  textToHighlight={foundNote.title}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
