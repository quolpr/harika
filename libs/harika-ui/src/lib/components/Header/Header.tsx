import React, { useCallback, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Calendar as CalendarIcon } from 'heroicons-react';
import './styles.css';
import { isArray } from 'util';
import dayjs from 'dayjs';
import Calendar from 'react-calendar';
import clsx from 'clsx';
import { useClickAway, useKey } from 'react-use';
import { useCurrentNote, useCurrentVault } from '@harika/harika-utils';
import { observer } from 'mobx-react-lite';
import { CommandPaletteModal } from '../CommandPaletteModal/CommandPaleteModal';

export const Header = observer(
  ({
    className,
    onTogglerClick,
    isTogglerToggled,
  }: {
    className?: string;
    onTogglerClick: () => void;
    isTogglerToggled: boolean;
  }) => {
    const vault = useCurrentVault();
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

        const result = await vault.getOrCreateDailyNote(dayjs(date));

        if (result.status === 'ok') {
          history.replace(`/notes/${result.data.$modelId}`);
        }
      },
      [vault, history]
    );

    // <Link to="/">
    //   Harika<div className="header__brand-dot">.</div>
    // </Link>

    return (
      <div className={clsx('header', className)}>
        <div
          className={clsx('header__sidebar-toggler', {
            'header__sidebar-toggler--toggled': isTogglerToggled,
          })}
          onClick={onTogglerClick}
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
          className="header__command-palette"
        >
          Command Palette
          <span className="command">
            <kbd className="font-sans">
              <abbr title="Command" className="no-underline">
                ⌘
              </abbr>
            </kbd>
            <kbd className="font-sans">K</kbd>
          </span>
        </button>

        <div className="header__right">
          {isModalOpened && (
            <CommandPaletteModal
              isOpened={isModalOpened}
              onClose={() => setIsModalOpened(false)}
            />
          )}
          <div ref={calendarRef} className="header__calendar-wrapper">
            <button onClick={handleOnCalendarClick}>
              <CalendarIcon className="header__calendar-icon" size={26} />
            </button>

            {/** Calendar doesn't have inputRef in typing :(*/}
            <Calendar
              onChange={handleCalendarChange}
              value={currentNote?.dailyNoteDate}
              className={clsx('header__calendar', {
                'header__calendar--opened': isCalendarOpened,
              })}
            />
          </div>
        </div>
      </div>
    );
  }
);
