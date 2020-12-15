import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHarikaStore } from '@harika/harika-core';
import { useHistory } from 'react-router-dom';

export const MainPageRedirect = () => {
  const store = useHarikaStore();
  const history = useHistory();

  useEffect(() => {
    const toExecute = async () => {
      const note = store.getOrCreateDailyNote(dayjs());

      history.replace(`/notes/${note.$modelId}`);
    };

    toExecute();
  }, [history, store]);

  return null;
};
