import React, { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';
import { ChevronRightIcon, ReplyIcon } from '@heroicons/react/solid';
import Highlighter from 'react-highlight-words';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { cn } from '../../utils';
import { useKey } from 'react-use';
import { v4 as uuidv4 } from 'uuid';
import { paths } from '../../paths';
import { useNotesService } from '../../contexts/CurrentNotesServiceContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { Modal, modalClass } from '../Modal/Modal';
import { debounceTime, map, Observable, of, switchMap, tap } from 'rxjs';
import { generateStackedNotePath } from '../../hooks/useNoteClick';
import { usePrimaryNoteId } from '../../hooks/usePrimaryNote';
import { useObservable, useObservableState } from 'observable-hooks';
import type { NotesService } from '@harika/web-core';

// Command executes on each user type and as result gives list of actions
// Commands are start with `!`. If no `!` present - then search happen between all start view actions names

const commandPaletteModalClass = cn('command-palette-modal');

type IAction = (
  | {
      id: string;
      name: string;
      type: 'goToPage';
      href: string;
      stackHref?: string;
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
    }
) & { highlight?: string };

type IView = {
  actions: IAction[];
};

const spawnView = ([
  inputCommandValue,
  vaultModelId,
  noteService,
  startView,
  locationSearch,
  primaryNoteId,
]: [
  string,
  string,
  NotesService,
  IView,
  string,
  string | undefined,
]): Observable<IView> => {
  if (inputCommandValue.startsWith('!findOrCreate')) {
    const toFind = inputCommandValue
      .trim()
      .replace(/^!findOrCreate/, '')
      .trim();

    const createNoteAction: IAction = {
      id: uuidv4(),
      name: `Create note "${toFind}"`,
      type: 'createNote',
      noteName: toFind,
    };

    return (
      toFind.length === 0 ? of([]) : noteService.findNotesOrBlocks$(toFind)
    ).pipe(
      map((rows) => {
        return {
          actions: [
            ...rows.map(
              ({ id, title }): IAction => ({
                id,
                name: title,
                type: 'goToPage',
                href: paths.vaultNotePath({
                  vaultId: vaultModelId,
                  noteId: id,
                }),
                stackHref:
                  primaryNoteId &&
                  generateStackedNotePath(
                    locationSearch,
                    vaultModelId,
                    primaryNoteId,
                    id,
                  ),

                highlight: toFind,
              }),
            ),
            ...(toFind.length !== 0 ? [createNoteAction] : []),
          ],
        };
      }),
    );
  } else {
    const actualInputValue = inputCommandValue.trim();

    return of(
      actualInputValue.length !== 0
        ? {
            actions: startView.actions
              .filter(
                (action) =>
                  action.name
                    .toLowerCase()
                    .indexOf(inputCommandValue.toLowerCase()) !== -1 ||
                  ('commandToType' in action &&
                    action.commandToType.indexOf(inputCommandValue) !== -1),
              )
              .map((action) => ({
                ...action,
                highlight: actualInputValue,
              })),
          }
        : startView,
    );
  }
};

export const CommandPaletteModal = ({
  isOpened,
  onClose,
}: {
  isOpened: boolean;
  onClose: () => void;
}) => {
  const location = useLocation();

  const primaryNoteId = usePrimaryNoteId();

  const history = useHistory();
  const vault = useCurrentVault();
  const noteService = useNotesService();
  const [inputCommandValue, setInputCommandValue] = useState('!findOrCreate ');

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
          name: 'Find or create note',
          type: 'typeCommand',
          commandToType: '!findOrCreate ',
        },
      ],
    }),
    [vault.$modelId],
  );

  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const searchItemRefs = useRef<Record<string, HTMLElement>>({});

  const [focusedActionId, setActionCommandId] = useState<undefined | string>(
    startView.actions[0].id,
  );
  const currentView$ = useObservable(
    ($inputs) => {
      return $inputs.pipe(
        debounceTime(300),
        switchMap((args) => spawnView(args)),
        tap((view) => {
          if (view.actions[0]) {
            setActionCommandId(view.actions[0].id);
          } else {
            setActionCommandId(undefined);
          }
        }),
      );
    },
    [
      inputCommandValue,
      vault.$modelId,
      noteService,
      startView,
      location.search,
      primaryNoteId,
    ],
  );

  const view = useObservableState(currentView$, startView);
  const focusedIndex = view.actions.findIndex((n) => n.id === focusedActionId);

  const performAction = useCallback(
    async (action: IAction, isShift: boolean) => {
      switch (action.type) {
        case 'goToPage':
          if (isShift && action.stackHref) {
            history.push(action.stackHref);
          } else {
            history.push(action.href + location.search);
          }

          onClose();
          break;
        case 'createNote': {
          const result = await noteService.createNote({
            title: action.noteName,
          });

          if (result.status === 'error') {
            alert(JSON.stringify(result.errors));

            return;
          }

          history.push(
            paths.vaultNotePath({
              vaultId: vault.$modelId,
              noteId: result.data.$modelId,
            }),
          );

          onClose();
          break;
        }
        case 'typeCommand':
          setInputCommandValue(action.commandToType);
          break;
      }
    },
    [onClose, history, location.search, noteService, vault.$modelId],
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
    [focusedIndex, view.actions],
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
    [view.actions, focusedIndex],
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

        if (action) performAction(action, e.shiftKey);
      }
    },
    undefined,
    [view.actions, performAction],
  );

  useKey(
    'Enter',
    (e) => {
      e.preventDefault();

      if (focusedActionId) {
        const action = view.actions[focusedIndex];

        if (action) performAction(action, e.shiftKey);
      }
    },
    undefined,
    [view.actions, focusedIndex, performAction],
  );

  useEffect(() => {
    if (focusedActionId && searchItemRefs.current[focusedActionId]) {
      searchItemRefs.current[focusedActionId].scrollIntoView({
        block: 'nearest',
      });
    }
  }, [focusedActionId]);

  return (
    <Modal isOpened={isOpened} onClose={onClose} fullHeight>
      <header
        className={`${commandPaletteModalClass('header')} ${modalClass(
          'header',
        )}`}
      >
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
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
              }
            }}
          />
        </form>
      </header>
      <div
        className={`${commandPaletteModalClass(
          'actions-list-container',
        )} ${modalClass('row')} ${modalClass('footer')}`}
      >
        <div className={commandPaletteModalClass('actions-list')}>
          {view.actions.map((action, i) => {
            const props = {
              key: action.id,
              className: commandPaletteModalClass('action', {
                focused: action.id === focusedActionId,
              }),

              onClick: (e: React.MouseEvent<HTMLElement>) => {
                e.preventDefault();

                performAction(action, e.shiftKey);
              },
              onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
                if (
                  prevMousePosRef.current.x === e.screenX &&
                  prevMousePosRef.current.y === e.screenY
                )
                  return;

                prevMousePosRef.current = { x: e.screenX, y: e.screenY };

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
                  {action.highlight ? (
                    <Highlighter
                      searchWords={[action.highlight]}
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
                          <ReplyIcon style={{ width: 20 }} />
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
