import { CalendarIcon } from '@heroicons/react/solid';
import dayjs from 'dayjs';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import { useClickAway, useKey } from 'react-use';
import tw, { css, styled } from 'twin.macro';

import { useNotePath } from '../../contexts/StackedNotesContext';
import { usePrimaryNote } from '../../hooks/usePrimaryNote';
import { useNoteBlocksService } from '../../hooks/vaultAppHooks';
import { cn, useNavigateRef } from '../../utils';
import { CommandPaletteModal } from '../CommandPaletteModal/CommandPaleteModal';
import { SyncState } from '../SyncState/SyncState';

const vaultHeaderClass = cn('header');

const Header = styled.div`
  ${tw`transition-all flex items-center justify-between bg-gray-900 bg-opacity-90`}

  position: absolute;
  right: 0;
  left: 0;
  top: 0;

  box-sizing: content-box;

  height: var(--vault-header-height);
  padding-top: var(--vault-header-padding-top);
  padding-bottom: var(--vault-header-padding-bottom);

  backdrop-filter: blur(5px);

  z-index: 100;
`;

const CalendarWrapper = styled.div`
  ${tw`mr-8 relative`}
`;

const CalendarIconStyled = styled(CalendarIcon)`
  ${tw`text-pink-600`}
  margin-top: 2px;
`;

const CalendarStyled = styled(Calendar)<{ opened: boolean }>`
  ${tw`top-2 right-0 -mr-2`}
  display: none;

  position: absolute;
  min-width: 350px;

  z-index: 100;

  ${({ opened }) =>
    opened &&
    css`
      display: block;
    `}
`;

const TogglerStyled = styled.button<{ toggled: boolean }>`
  ${tw`hover:text-pink-600 transition-all p-3 pl-6`}

  cursor: pointer;

  ${({ toggled }) => toggled && tw`text-pink-600`}
`;

const RightPart = styled.div`
  display: flex;
`;

const CommandPaletteBtn = styled.button`
  ${tw`text-gray-400`}
`;

const CommandPaletteHotkey = styled.span`
  ${tw`ml-2`}
  display: none;

  @media (min-width: 768px) {
    display: inline-block;
  }
`;

export const VaultHeader = observer(
  ({
    onTogglerClick,
    isTogglerToggled,
    togglerRef,
  }: {
    onTogglerClick: () => void;
    isTogglerToggled: boolean;
    togglerRef: React.Ref<HTMLElement>;
  }) => {
    const noteService = useNoteBlocksService();
    const navigate = useNavigateRef();

    const primaryNote = usePrimaryNote();

    const [isModalOpened, setIsModalOpened] = useState(false);

    const [isCalendarOpened, setIsCalendarOpened] = useState(false);

    const calendarRef = useRef(null);

    useKey(
      'k',
      (e) => {
        if (e.metaKey) setIsModalOpened(!isModalOpened);
      },
      undefined,
      [isModalOpened],
    );

    useClickAway(calendarRef, () => {
      setIsCalendarOpened(false);
    });

    const handleOnCalendarClick = useCallback(() => {
      setIsCalendarOpened(!isCalendarOpened);
    }, [isCalendarOpened]);

    const notePath = useNotePath();

    const handleCalendarChange = useCallback(
      async (date: Date | Date[], ev: React.ChangeEvent<HTMLInputElement>) => {
        if (Array.isArray(date)) return;

        const result = await noteService.getOrCreateDailyNote(dayjs(date));

        if (result.status === 'ok') {
          navigate.current(
            notePath(
              result.data.$modelId,
              (ev.nativeEvent as MouseEvent).shiftKey,
            ),
          );
        }
      },
      [noteService, navigate, notePath],
    );

    return (
      <Header className={vaultHeaderClass()}>
        <TogglerStyled
          toggled={isTogglerToggled}
          className={vaultHeaderClass('sidebar-toggler', {
            toggled: isTogglerToggled,
          })}
          onMouseUp={() => {
            onTogglerClick();
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              onTogglerClick();
            }
          }}
          ref={togglerRef as React.Ref<HTMLButtonElement>}
          role="switch"
          aria-label="Toggle menu"
          aria-checked={isTogglerToggled}
        >
          <svg
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
            height="20"
            width="20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </TogglerStyled>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SyncState />
          <CommandPaletteBtn
            onClick={() => {
              setIsModalOpened(!isModalOpened);
            }}
            className={vaultHeaderClass('command-palette')}
          >
            Find Or Create
            <CommandPaletteHotkey
              className={vaultHeaderClass('command-palette-hotkey')}
            >
              <kbd className="font-sans">
                <abbr title="Command" className="no-underline">
                  ⌘
                </abbr>
              </kbd>
              <kbd className="font-sans">K</kbd>
            </CommandPaletteHotkey>
          </CommandPaletteBtn>
        </div>

        <RightPart className={vaultHeaderClass('right')}>
          {isModalOpened && (
            <CommandPaletteModal
              isOpened={isModalOpened}
              onClose={() => setIsModalOpened(false)}
            />
          )}
          <CalendarWrapper
            ref={calendarRef}
            className={vaultHeaderClass('calendar-wrapper')}
          >
            <button onClick={handleOnCalendarClick} aria-label="Calendar">
              <CalendarIconStyled
                className={vaultHeaderClass('calendar-icon')}
                style={{ width: 26 }}
              />
            </button>

            {/** Calendar doesn't have inputRef in typing :(*/}
            <CalendarStyled
              onChange={handleCalendarChange}
              value={
                primaryNote?.dailyNoteDate !== undefined
                  ? new Date(primaryNote?.dailyNoteDate)
                  : undefined
              }
              className={vaultHeaderClass('calendar', {
                opened: isCalendarOpened,
              })}
              opened={isCalendarOpened}
            />
          </CalendarWrapper>
        </RightPart>
      </Header>
    );
  },
);
