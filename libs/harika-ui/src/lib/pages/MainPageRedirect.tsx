import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHistory } from 'react-router-dom';
import { useCurrentVault } from '@harika/harika-utils';

export const MainPageRedirect = () => {
  const vault = useCurrentVault();
  const history = useHistory();

  useEffect(() => {
    const toExecute = async () => {
      const result = await vault.getOrCreateDailyNote(dayjs());

      if (result.status === 'ok') {
        history.replace(`/notes/${result.data.$modelId}`);
      }
    };

    toExecute();
  }, [history, vault]);

  return null;
};
