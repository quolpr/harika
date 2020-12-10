import { useEffect } from 'react';
import { getOrCreateDailyNote } from '@harika/harika-notes';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useHistory } from 'react-router-dom';
import dayjs from 'dayjs';

export const MainPageRedirect = () => {
  const database = useDatabase();
  const history = useHistory();

  useEffect(() => {
    const toExecute = async () => {
      const note = await getOrCreateDailyNote(database, dayjs());

      history.replace(`/notes/${note.id}`);
    };

    toExecute();
  }, [database, history]);

  return null;
};
