import React, { useCallback, useRef, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { Calendar as CalendarIcon } from 'heroicons-react';
import './styles.css';
import { isArray } from 'util';
import dayjs from 'dayjs';
import Calendar from 'react-calendar';
import clsx from 'clsx';
import { useClickAway } from 'react-use';
import { useCurrentNote, useCurrentVault } from '@harika/harika-utils';
import { observer } from 'mobx-react-lite';

export const Header = observer(() => {
  const vault = useCurrentVault();
  const history = useHistory();

  const currentNote = useCurrentNote();

  const [isOpened, setIsOpened] = useState(false);

  const calendarRef = useRef(null);
  useClickAway(calendarRef, () => {
    setIsOpened(false);
  });

  const handleOnCalendarClick = useCallback(() => {
    setIsOpened(!isOpened);
  }, [isOpened]);

  const handleCalendarChange = useCallback(
    async (date: Date | Date[]) => {
      if (isArray(date)) return;

      const note = await vault.getOrCreateDailyNote(dayjs(date));

      history.replace(`/notes/${note.$modelId}`);
    },
    [vault, history]
  );

  return (
    <div className="header">
      <div className="header__brand">
        <Link to="/">
          Harika<div className="header__brand-dot">.</div>
        </Link>
      </div>

      <div ref={calendarRef} className="header__calendar-wrapper">
        <button onClick={handleOnCalendarClick}>
          <CalendarIcon className="header__calendar-icon" size={26} />
        </button>

        {/** Calendar doesn't have inputRef in typing :(*/}
        <Calendar
          onChange={handleCalendarChange}
          value={currentNote?.dailyNoteDate}
          className={clsx('header__calendar', {
            'header__calendar--opened': isOpened,
          })}
        />
      </div>
    </div>
  );
});
