import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import './styles.css';
import { Search as SearchIcon } from 'heroicons-react';
import { useCurrentVault } from '@harika/harika-utils';
import Highlighter from 'react-highlight-words';
import { Link, useHistory } from 'react-router-dom';
import { cn } from '../../utils';
import { useKey } from 'react-use';
import { v4 as uuidv4 } from 'uuid';

const searchModalClass = cn('command-palette-modal');

type ICommand =
  | {
      id: string;
      name: string;
      type: 'goToPage';
      href: string;
    }
  | {
      id: string;
      name: string;
      type: 'typeCommand';
      commandToType: string;
    }
  | {
      id: string;
      name: string;
      type: 'createNote';
      noteName: string;
    };

type IView = {
  highlight?: string;
  commands: ICommand[];
};

const startView: IView = {
  commands: [
    { id: uuidv4(), name: 'Daily note', type: 'goToPage', href: '/' },
    {
      id: uuidv4(),
      name: 'Create new note',
      type: 'typeCommand',
      commandToType: '!new ',
    },
    {
      id: uuidv4(),
      name: 'Find note',
      type: 'typeCommand',
      commandToType: '!find ',
    },
  ],
};

export const CommandPaletteModal = ({
  isOpened,
  onClose,
}: {
  isOpened: boolean;
  onClose: () => void;
}) => {
  const history = useHistory();
  const vault = useCurrentVault();
  const [inputValue, setInputValue] = useState('');

  const [view, setView] = useState(startView);
  const [focusedCommandId, setFocusedCommandId] = useState<undefined | string>(
    startView.commands[0].id
  );

  const searchItemRefs = useRef<Record<string, HTMLElement>>({});

  useEffect(() => {
    // TODO: rxJS
    const cb = async () => {
      const newView = await (async (): Promise<IView> => {
        if (inputValue.startsWith('!new')) {
          const newNoteName = inputValue.trim().replace(/^!new/, '').trim();

          return {
            commands: [
              {
                id: uuidv4(),
                name: `Create note "${newNoteName}"`,
                type: 'createNote',
                noteName: newNoteName,
              },
            ],
          };
        } else if (inputValue.startsWith('!find')) {
          const toFind = inputValue
            .trim()
            .replace(/^!find/, '')
            .trim();

          const notes = await vault.searchNotes(toFind);

          return {
            highlight: toFind,
            commands: notes.map(({ id, title }) => ({
              id,
              name: title,
              type: 'goToPage',
              href: `/notes/${id}`,
            })),
          };
        } else {
          const actualInputValue = inputValue.trim();

          return actualInputValue.length !== 0
            ? {
                commands: startView.commands.filter(
                  ({ name }) =>
                    name.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                ),
                highlight: actualInputValue,
              }
            : startView;
        }
      })();

      setView(newView);

      if (newView.commands[0]) {
        setFocusedCommandId(newView.commands[0].id);
      } else {
        setFocusedCommandId(undefined);
      }
    };

    cb();
  }, [inputValue, vault]);

  const performCommand = useCallback(
    (command: ICommand) => {
      switch (command.type) {
        case 'goToPage':
          history.push(command.href);

          onClose();
          break;
        case 'createNote': {
          const note = vault.createNote({ title: command.noteName });

          history.push(`/notes/${note.$modelId}`, {
            focusOnBlockId: note.children[0].$modelId,
          });

          onClose();
          break;
        }
        case 'typeCommand':
          setInputValue(command.commandToType);
          break;
      }
    },
    [onClose, history, vault]
  );

  useKey(
    'ArrowDown',
    () => {
      const i = view.commands.findIndex((n) => n.id === focusedCommandId);

      if (i === -1 || i === view.commands.length - 1) {
        setFocusedCommandId(view.commands[0]?.id);
      } else {
        setFocusedCommandId(view.commands[i + 1].id);
      }
    },
    undefined,
    [view.commands, focusedCommandId]
  );

  useKey(
    'ArrowUp',
    () => {
      const i = view.commands.findIndex((n) => n.id === focusedCommandId);

      if (i === -1) return;

      if (i === 0) {
        setFocusedCommandId(view.commands[view.commands.length - 1]?.id);
      } else {
        setFocusedCommandId(view.commands[i - 1].id);
      }
    },
    undefined,
    [view.commands, focusedCommandId]
  );

  useKey(
    'Enter',
    () => {
      if (focusedCommandId) {
        const command = view.commands.find(({ id }) => id === focusedCommandId);

        if (command) performCommand(command);
      }
    },
    undefined,
    [focusedCommandId, onClose]
  );

  useEffect(() => {
    if (focusedCommandId && searchItemRefs.current[focusedCommandId]) {
      searchItemRefs.current[focusedCommandId].scrollIntoView({
        block: 'nearest',
      });
    }
  }, [focusedCommandId]);

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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
                e.preventDefault();
            }}
          />
        </form>
      </header>
      <div className={searchModalClass('search-result-container')}>
        <div className={searchModalClass('search-result')}>
          {view.commands.map((command) => {
            const props = {
              key: command.id,
              className: searchModalClass('search-item', {
                focused: command.id === focusedCommandId,
              }),

              onClick: (e: React.MouseEvent<HTMLElement>) => {
                e.preventDefault();
                performCommand(command);
              },
              onMouseEnter: () => {
                setFocusedCommandId(command.id);
              },
              ref: (el: HTMLElement | null) => {
                if (el) {
                  searchItemRefs.current[command.id] = el;
                } else {
                  delete searchItemRefs.current[command.id];
                }
              },

              children: view.highlight ? (
                <Highlighter
                  searchWords={[view.highlight]}
                  autoEscape={true}
                  textToHighlight={command.name}
                />
              ) : (
                command.name
              ),
            };

            return command.type === 'goToPage' ? (
              <Link to={command.href} {...props} />
            ) : (
              <button {...props} />
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
