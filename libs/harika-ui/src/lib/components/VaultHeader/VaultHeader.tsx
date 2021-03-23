import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Calendar as CalendarIcon } from 'heroicons-react';
import './styles.css';
import { isArray } from 'util';
import dayjs from 'dayjs';
import Calendar from 'react-calendar';
import clsx from 'clsx';
import { useClickAway, useKey, useMedia } from 'react-use';
import { observer } from 'mobx-react-lite';
import { CommandPaletteModal } from '../CommandPaletteModal/CommandPaleteModal';
import { paths } from '../../paths';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { useCurrentNote } from '../../hooks/useCurrentNote';
import { cn } from '../../utils';

const vaultHeaderClass = cn('header');

export const VaultHeader = observer(
  ({
    className,
    onTogglerClick,
    isTogglerToggled,
    togglerRef,
  }: {
    className?: string;
    onTogglerClick: (e: React.MouseEvent) => void;
    isTogglerToggled: boolean;
    togglerRef: React.Ref<HTMLDivElement>;
  }) => {
    const vault = useCurrentVault();
    const noteRepo = useNoteRepository();
    const history = useHistory();

    const [isModalOpened, setIsModalOpened] = useState(false);

    const currentNote = useCurrentNote();

    const [isCalendarOpened, setIsCalendarOpened] = useState(false);

    const calendarRef = useRef(null);

    useKey(
      'k',
      (e) => {
        if (e.metaKey) setIsModalOpened(!isModalOpened);
      },
      undefined,
      [isModalOpened]
    );

    useClickAway(calendarRef, () => {
      setIsCalendarOpened(false);
    });

    const handleOnCalendarClick = useCallback(() => {
      setIsCalendarOpened(!isCalendarOpened);
    }, [isCalendarOpened]);

    const handleCalendarChange = useCallback(
      async (date: Date | Date[]) => {
        if (isArray(date)) return;

        const result = await noteRepo.getOrCreateDailyNote(vault, dayjs(date));

        if (result.status === 'ok') {
          history.replace(
            paths.vaultNotePath({
              vaultId: vault.$modelId,
              noteId: result.data.$modelId,
            })
          );
        }
      },
      [vault, history, noteRepo]
    );

    return (
      <div className={clsx(vaultHeaderClass(), className)}>
        <div
          className={vaultHeaderClass('sidebar-toggler', {
            toggled: isTogglerToggled,
          })}
          onClick={onTogglerClick}
          ref={togglerRef}
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
        </div>

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
            <button onClick={handleOnCalendarClick}>
              <CalendarIcon
                className={vaultHeaderClass('calendar-icon')}
                size={26}
              />
            </button>

            {/** Calendar doesn't have inputRef in typing :(*/}
            <Calendar
              onChange={handleCalendarChange}
              value={currentNote?.dailyNoteDate}
              className={vaultHeaderClass('calendar', {
                opened: isCalendarOpened,
              })}
            />
          </div>
        </div>
      </div>
    );
  }
);
