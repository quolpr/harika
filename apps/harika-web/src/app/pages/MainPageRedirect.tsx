import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHarikaStore } from '@harika/harika-core';
import { useHistory } from 'react-router-dom';

export const MainPageRedirect = () => {
  const store = useHarikaStore();
  const history = useHistory();

  useEffect(() => {
    const toExecute = async () => {
      const note = await store.getOrCreateDailyNote(dayjs().add(2, 'year'));

      history.replace(`/notes/${note.$modelId}`);
    };

    toExecute();
  }, [history, store]);

  return null;
};
