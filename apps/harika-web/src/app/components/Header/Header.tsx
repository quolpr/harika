import React, { useCallback, useRef, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { Calendar as CalendarIcon } from 'heroicons-react';
import './styles.css';
import { isArray } from 'util';
import dayjs from 'dayjs';
import { useCurrentNote } from '../../hooks/useCurrentNote';
import Calendar from 'react-calendar';
import clsx from 'clsx';
import { useClickAway } from 'react-use';
import { useRxDB } from 'rxdb-hooks';
import { HarikaDatabase } from '../../initDb';
import { getOrCreateDailyNote } from '../../models/note';

export const Header = () => {
  const db = useRxDB<HarikaDatabase>();
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

      const note = await getOrCreateDailyNote(db, dayjs(date));

      history.replace(`/notes/${note._id}`);
    },
    [db, history]
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
          <CalendarIcon className="header__calendar-icon" size={30} />
        </button>

        {/** Calendar doesn't have inputRef in typing :(*/}
        <Calendar
          onChange={handleCalendarChange}
          value={
            currentNote ? new Date(currentNote.dailyNoteDate * 1000) : undefined
          }
          className={clsx('header__calendar', {
            'header__calendar--opened': isOpened,
          })}
        />
      </div>
    </div>
  );
};
