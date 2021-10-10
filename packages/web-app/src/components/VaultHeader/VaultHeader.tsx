import React, { useCallback, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { CalendarIcon } from '@heroicons/react/solid';
import './styles.css';
import dayjs from 'dayjs';
import Calendar from 'react-calendar';
import clsx from 'clsx';
import { useClickAway, useKey } from 'react-use';
import { observer } from 'mobx-react-lite';
import { CommandPaletteModal } from '../CommandPaletteModal/CommandPaleteModal';
import { paths } from '../../paths';
import { cn } from '../../utils';
import { generateStackedNotePath } from '../../hooks/useNoteClick';
import { usePrimaryNote } from '../../hooks/usePrimaryNote';
import { SyncState } from '../SyncState/SyncState';
import { useCurrentVaultApp, useVaultService } from '../../hooks/vaultAppHooks';

const vaultHeaderClass = cn('header');

export const VaultHeader = observer(
  ({
    className,
    onTogglerClick,
    isTogglerToggled,
    togglerRef,
  }: {
    className?: string;
    onTogglerClick: () => void;
    isTogglerToggled: boolean;
    togglerRef: React.Ref<HTMLElement>;
  }) => {
    const location = useLocation();
    const vaultApp = useCurrentVaultApp();
    const noteService = useVaultService();
    const history = useHistory();

    const primaryNote = usePrimaryNote();
    const primaryNoteId = primaryNote?.$modelId;

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

    const handleCalendarChange = useCallback(
      async (date: Date | Date[], ev: React.ChangeEvent<HTMLInputElement>) => {
        if (Array.isArray(date)) return;

        const result = await noteService.getOrCreateDailyNote(dayjs(date));

        if (result.status === 'ok') {
          if ((ev.nativeEvent as MouseEvent).shiftKey && primaryNoteId) {
            history.replace(
              generateStackedNotePath(
                location.search,
                vaultApp.applicationId,
                primaryNoteId,
                result.data.$modelId,
              ),
            );
          } else {
            history.replace(
              paths.vaultNotePath({
                vaultId: vaultApp.applicationId,
                noteId: result.data.$modelId,
              }) + location.search,
            );
          }
        }
      },
      [
        noteService,
        primaryNoteId,
        history,
        location.search,
        vaultApp.applicationId,
      ],
    );

    return (
      <div className={clsx(vaultHeaderClass(), className)}>
        <button
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
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SyncState />
          <button
            onClick={() => {
              setIsModalOpened(!isModalOpened);
            }}
            className={vaultHeaderClass('command-palette')}
          >
            Find Or Create
            <span className={vaultHeaderClass('command-palette-hotkey')}>
              <kbd className="font-sans">
                <abbr title="Command" className="no-underline">
                  ⌘
                </abbr>
              </kbd>
              <kbd className="font-sans">K</kbd>
            </span>
          </button>
        </div>

        <div className={vaultHeaderClass('right')}>
          {isModalOpened && (
            <CommandPaletteModal
              isOpened={isModalOpened}
              onClose={() => setIsModalOpened(false)}
            />
          )}
          <div
            ref={calendarRef}
            className={vaultHeaderClass('calendar-wrapper')}
          >
            <button onClick={handleOnCalendarClick} aria-label="Calendar">
              <CalendarIcon
                className={vaultHeaderClass('calendar-icon')}
                style={{ width: 26 }}
              />
            </button>

            {/** Calendar doesn't have inputRef in typing :(*/}
            <Calendar
              onChange={handleCalendarChange}
              value={
                primaryNote?.dailyNoteDate !== undefined
                  ? new Date(primaryNote?.dailyNoteDate)
                  : undefined
              }
              className={vaultHeaderClass('calendar', {
                opened: isCalendarOpened,
              })}
            />
          </div>
        </div>
      </div>
    );
  },
);
