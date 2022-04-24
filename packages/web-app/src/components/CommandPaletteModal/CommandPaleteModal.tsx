import { FindNoteOrBlockService } from '@harika/web-core/src/apps/VaultApplication/BlocksExtension/services/FindNoteOrBlockService';
import { ChevronRightIcon } from '@heroicons/react/solid';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Highlighter from 'react-highlight-words';
import { Link, useLocation } from 'react-router-dom';
import { useKey } from 'react-use';
import { debounce, map, Observable, of, switchMap, tap, timer } from 'rxjs';
import tw, { css, styled } from 'twin.macro';
import { v4 as uuidv4 } from 'uuid';

import { useNotePath } from '../../contexts/StackedNotesContext';
import {
  useCurrentVaultApp,
  useFindService,
  useNoteBlocksService,
} from '../../hooks/vaultAppHooks';
import { paths } from '../../paths';
import { cn, useNavigateRef } from '../../utils';
import { Modal, modalClass } from '../Modal/Modal';
import { modalFooterCss, ModalHeader, ModalRow } from '../Modal/styles';

// Command executes on each user type and as result gives list of actions
// Commands are start with `!`. If no `!` present - then search happen between all start view actions names

const commandPaletteModalClass = cn('command-palette-modal');

const Form = styled.form`
  ${tw`h-16 border-b border-gray-800`}
  display: flex;

  align-items: center;
`;

const CommandIcon = styled(ChevronRightIcon)`
  ${tw`text-gray-600 w-5`}
  display: block-inline;
`;

const CommandInput = styled.input`
  ${tw`border-gray-800 bg-gray-900 text-gray-300 px-2 py-1 rounded w-40`}
  ${tw`focus:outline-none focus:border-gray-700`}
  ${tw`ml-2`}
  ${tw`bg-opacity-0`}

  width: 100%;
  height: 100%;
`;

const Action = styled.div<{ focused?: boolean }>`
  ${tw`px-5 py-3 mb-3`}
  ${tw`bg-gray-800 rounded-xl shadow`}

  display: flex;
  align-items: center;

  width: 100%;
  text-align: left;

  word-wrap: break-word;
  white-space: pre-wrap;
  word-break: break-word;
  ${({ focused }) =>
    focused &&
    css`
      ${tw`bg-pink-800`}
    `}
`;

const ActionBtn = Action.withComponent('button');
const ActionLink = Action.withComponent(Link);

const Key = styled.div<{ focused: boolean }>`
  ${tw`text-gray-500`}
  margin-left: auto;
  flex-shrink: 0;
  padding-left: 0.2rem;

  ${({ focused }) =>
    focused &&
    css`
      ${tw`text-gray-300`}
    `}
`;

const ListContainer = styled(ModalRow)`
  ${tw`mt-6`}

  ${modalFooterCss}

  flex: auto;
  overflow: auto;
`;

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
  findNoteOrBlockService,
  startView,
  notePath,
]: [
  string,
  string,
  FindNoteOrBlockService,
  IView,
  (noteId: string, openStacked?: boolean) => string,
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
      toFind.length === 0 ? of([]) : findNoteOrBlockService.find$(toFind)
    ).pipe(
      map((rows) => {
        return {
          actions: [
            ...rows.map(
              ({ rootBlockId, blockId, data }): IAction => ({
                id: `${rootBlockId}-${blockId}`,
                name: data,
                type: 'goToPage',
                href: notePath(rootBlockId),
                stackHref: notePath(rootBlockId, true),
                highlight: toFind,
              }),
            ),
            ...(toFind.length === 0 ||
            rows.find(
              (r) =>
                r.blockType === 'noteBlock' &&
                r.data.toLowerCase() === toFind.toLowerCase(),
            )
              ? []
              : [createNoteAction]),
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

const emptyView = { actions: [] };

export const CommandPaletteModal = ({
  isOpened,
  onClose,
}: {
  isOpened: boolean;
  onClose: () => void;
}) => {
  const location = useLocation();

  const navigate = useNavigateRef();
  const vault = useCurrentVaultApp();
  const notesService = useNoteBlocksService();
  const findService = useFindService();
  const [inputCommandValue, setInputCommandValue] = useState('!findOrCreate ');

  const startView: IView = React.useMemo(
    () => ({
      actions: [
        {
          id: uuidv4(),
          name: 'Daily note',
          type: 'goToPage',
          href: paths.vaultDailyPath({ vaultId: vault.applicationId }),
        },
        {
          id: uuidv4(),
          name: 'Find or create note',
          type: 'typeCommand',
          commandToType: '!findOrCreate ',
        },
      ],
    }),
    [vault.applicationId],
  );

  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const searchItemRefs = useRef<Record<string, HTMLElement>>({});

  const notePath = useNotePath();

  const [focusedActionId, setActionCommandId] = useState<undefined | string>(
    startView.actions?.[0]?.id,
  );
  const currentView$ = useObservable(
    ($inputs) => {
      let wasFirstEmitHappened = false;

      return $inputs.pipe(
        debounce(() => timer(wasFirstEmitHappened ? 300 : 0)),
        switchMap((args) => spawnView(args)),
        tap((view) => {
          console.log({ view });

          wasFirstEmitHappened = true;
          if (view.actions[0]) {
            setActionCommandId(view.actions[0].id);
          } else {
            setActionCommandId(undefined);
          }
        }),
      );
    },
    [inputCommandValue, vault.applicationId, findService, startView, notePath],
  );

  const view = useObservableState(currentView$, emptyView);
  const focusedIndex = view.actions.findIndex((n) => n.id === focusedActionId);

  const performAction = useCallback(
    async (action: IAction, isShift: boolean) => {
      switch (action.type) {
        case 'goToPage':
          if (isShift && action.stackHref) {
            navigate.current(action.stackHref);
          } else {
            navigate.current(action.href + location.search);
          }

          onClose();
          break;
        case 'createNote': {
          const result = await notesService.createNote({
            title: action.noteName,
          });

          if (result.status === 'error') {
            alert(JSON.stringify(result.errors));

            return;
          }

          navigate.current(notePath(result.data.$modelId));

          onClose();
          break;
        }
        case 'typeCommand':
          setInputCommandValue(action.commandToType);
          break;
      }
    },
    [onClose, navigate, location.search, notesService, notePath],
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
      <ModalHeader
        className={`${commandPaletteModalClass('header')} ${modalClass(
          'header',
        )}`}
      >
        <Form
          action=""
          role="search"
          className={commandPaletteModalClass('form')}
          onSubmit={(e) => e.preventDefault()}
        >
          <CommandIcon className={commandPaletteModalClass('command-icon')} />
          <CommandInput
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
        </Form>
      </ModalHeader>
      <ListContainer
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
              focused: action.id === focusedActionId,

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
                      {i < 9 && (
                        <Key
                          className={commandPaletteModalClass('key', {
                            focused: action.id === focusedActionId,
                          })}
                          focused={action.id === focusedActionId}
                        >
                          ⌘{i + 1}
                        </Key>
                      )}
                    </>
                  )}
                </>
              ),
            };

            return action.type === 'goToPage' ? (
              <ActionLink to={action.href} {...props} />
            ) : action.type === 'dummy' ? (
              <Action {...props} />
            ) : (
              <ActionBtn {...props} />
            );
          })}
        </div>
      </ListContainer>
    </Modal>
  );
};
