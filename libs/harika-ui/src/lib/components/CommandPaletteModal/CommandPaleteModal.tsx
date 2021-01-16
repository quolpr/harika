import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import './styles.css';
import {
  ChevronRight as ChevronRightIcon,
  Reply as ReplyIcon,
} from 'heroicons-react';
import { useCurrentVault } from '@harika/harika-utils';
import Highlighter from 'react-highlight-words';
import { Link, useHistory } from 'react-router-dom';
import { cn } from '../../utils';
import { useKey } from 'react-use';
import { v4 as uuidv4 } from 'uuid';
import { IFocusBlockState } from '../Note/Note';
import { paths } from '../../paths';

// Command executes on each user type and as result gives list of actions
// Commands are start with `!`. If no `!` present - then search happen between all start view actions names

const commandPaletteModalClass = cn('command-palette-modal');

type IAction =
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
    }
  | {
      id: string;
      name: string;
      type: 'dummy';
    };

type IView = {
  highlight?: string;
  actions: IAction[];
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
  const [inputCommandValue, setInputCommandValue] = useState('');

  const startView: IView = React.useMemo(
    () => ({
      actions: [
        {
          id: uuidv4(),
          name: 'Daily note',
          type: 'goToPage',
          href: paths.vaultDailyPath({ vaultId: vault.$modelId }),
        },
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
    }),
    [vault.$modelId]
  );

  const [view, setView] = useState(startView);
  const [focusedActionId, setActionCommandId] = useState<undefined | string>(
    startView.actions[0].id
  );
  const focusedIndex = view.actions.findIndex((n) => n.id === focusedActionId);

  const prevMosePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const searchItemRefs = useRef<Record<string, HTMLElement>>({});

  useEffect(() => {
    // TODO: rxJS
    const cb = async () => {
      const newView = await (async (): Promise<IView> => {
        if (inputCommandValue.startsWith('!new')) {
          const newNoteName = inputCommandValue
            .trim()
            .replace(/^!new/, '')
            .trim();

          return {
            actions: [
              {
                id: uuidv4(),
                name: `Create note "${newNoteName}"`,
                type: 'createNote',
                noteName: newNoteName,
              },
            ],
          };
        } else if (inputCommandValue.startsWith('!find')) {
          const toFind = inputCommandValue
            .trim()
            .replace(/^!find/, '')
            .trim();

          const notes = await vault.searchNotesTuples(toFind);

          return {
            highlight: toFind,
            actions: notes.map(({ id, title }) => ({
              id,
              name: title,
              type: 'goToPage',
              href: paths.vaultNotePath({
                vaultId: vault.$modelId,
                noteId: id,
              }),
            })),
          };
        } else {
          const actualInputValue = inputCommandValue.trim();

          return actualInputValue.length !== 0
            ? {
                actions: startView.actions.filter(
                  ({ name }) =>
                    name
                      .toLowerCase()
                      .indexOf(inputCommandValue.toLowerCase()) !== -1
                ),
                highlight: actualInputValue,
              }
            : startView;
        }
      })();

      setView(newView);

      if (newView.actions[0]) {
        setActionCommandId(newView.actions[0].id);
      } else {
        setActionCommandId(undefined);
      }
    };

    cb();
  }, [inputCommandValue, vault]);

  const performAction = useCallback(
    async (action: IAction) => {
      switch (action.type) {
        case 'goToPage':
          history.push(action.href);

          onClose();
          break;
        case 'createNote': {
          const result = await vault.createNote({ title: action.noteName });

          if (result.status === 'error') {
            alert(JSON.stringify(result.errors));

            return;
          }

          history.push(
            paths.vaultNotePath({
              vaultId: vault.$modelId,
              noteId: result.data.$modelId,
            }),
            {
              focusOnBlockId: result.data.children[0].$modelId,
            } as IFocusBlockState
          );

          onClose();
          break;
        }
        case 'typeCommand':
          setInputCommandValue(action.commandToType);
          break;
      }
    },
    [onClose, history, vault]
  );

  useKey(
    (e) => e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j'),
    () => {
      if (focusedIndex === -1 || focusedIndex === view.actions.length - 1) {
        setActionCommandId(view.actions[0]?.id);
      } else {
        setActionCommandId(view.actions[focusedIndex + 1].id);
      }
    },
    undefined,
    [focusedIndex, view.actions]
  );

  useKey(
    (e) => e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k'),
    () => {
      if (focusedIndex === -1) return;

      if (focusedIndex === 0) {
        setActionCommandId(view.actions[view.actions.length - 1]?.id);
      } else {
        setActionCommandId(view.actions[focusedIndex - 1].id);
      }
    },
    undefined,
    [view.actions, focusedIndex]
  );

  useKey(
    (e) =>
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key) &&
      (e.ctrlKey || e.metaKey),
    (e) => {
      e.preventDefault();

      const switchTo = parseInt(e.key, 10) - 1;

      if (switchTo < view.actions.length) {
        const action = view.actions[switchTo];

        if (action) performAction(action);
      }
    },
    undefined,
    [view.actions, performAction]
  );

  useKey(
    'Enter',
    (e) => {
      e.preventDefault();

      if (focusedActionId) {
        const action = view.actions[focusedIndex];

        if (action) performAction(action);
      }
    },
    undefined,
    [view.actions, focusedIndex, performAction]
  );

  useEffect(() => {
    if (focusedActionId && searchItemRefs.current[focusedActionId]) {
      searchItemRefs.current[focusedActionId].scrollIntoView({
        block: 'nearest',
      });
    }
  }, [focusedActionId]);

  return (
    <Modal
      isOpen={isOpened}
      style={{ overlay: { zIndex: 110 }, content: {} }}
      overlayClassName="ReactModal__Overlay"
      className="ReactModal__Content"
      shouldCloseOnOverlayClick={true}
      onRequestClose={onClose}
    >
      <header className={commandPaletteModalClass('header')}>
        <form
          action=""
          role="search"
          className={commandPaletteModalClass('form')}
          onSubmit={(e) => e.preventDefault()}
        >
          <ChevronRightIcon
            className={commandPaletteModalClass('command-icon')}
          />
          <input
            className={commandPaletteModalClass('command-input')}
            type="search"
            aria-autocomplete="list"
            ref={(el) => {
              if (el) {
                el.focus();
              }
            }}
            value={inputCommandValue}
            onChange={(e) => setInputCommandValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
                e.preventDefault();
            }}
          />
        </form>
      </header>
      <div className={commandPaletteModalClass('actions-list-container')}>
        <div className={commandPaletteModalClass('actions-list')}>
          {view.actions.map((action, i) => {
            const props = {
              key: action.id,
              className: commandPaletteModalClass('action', {
                focused: action.id === focusedActionId,
              }),

              onClick: (e: React.MouseEvent<HTMLElement>) => {
                e.preventDefault();
                performAction(action);
              },
              onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
                if (
                  prevMosePosRef.current.x === e.screenX &&
                  prevMosePosRef.current.y === e.screenY
                )
                  return;

                prevMosePosRef.current = { x: e.screenX, y: e.screenY };

                setActionCommandId(action.id);
              },
              ref: (el: HTMLElement | null) => {
                if (el) {
                  searchItemRefs.current[action.id] = el;
                } else {
                  delete searchItemRefs.current[action.id];
                }
              },

              children: (
                <>
                  {view.highlight ? (
                    <Highlighter
                      searchWords={[view.highlight]}
                      autoEscape={true}
                      textToHighlight={action.name}
                    />
                  ) : (
                    action.name
                  )}
                  {action.type !== 'dummy' && (
                    <>
                      {i < 9 && i !== focusedIndex && (
                        <div className={commandPaletteModalClass('key')}>
                          ⌘{i + 1}
                        </div>
                      )}
                      {i === focusedIndex && (
                        <div
                          className={commandPaletteModalClass('key', {
                            enter: true,
                            focused: action.id === focusedActionId,
                          })}
                        >
                          <ReplyIcon size={20} />
                        </div>
                      )}
                    </>
                  )}
                </>
              ),
            };

            return action.type === 'goToPage' ? (
              <Link to={action.href} {...props} />
            ) : action.type === 'dummy' ? (
              <div {...props} />
            ) : (
              <button {...props} />
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
