import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import dayjs from 'dayjs';
import { useRxDB } from 'rxdb-hooks';
import { HarikaDatabase } from '../initDb';
import { getOrCreateDailyNote } from '../models/note';

export const MainPageRedirect = () => {
  const db = useRxDB<HarikaDatabase>();
  const history = useHistory();

  useEffect(() => {
    if (!db) return;

    const toExecute = async () => {
      const note = await getOrCreateDailyNote(db, dayjs());

      history.replace(`/notes/${note._id}`);
    };

    toExecute();
  }, [db, history]);

  return null;
};
