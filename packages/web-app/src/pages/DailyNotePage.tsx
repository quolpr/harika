import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHistory } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useVaultService } from '../hooks/vaultAppHooks';
import { useNotePath } from '../contexts/StackedNotesContext';

export const DailyNotePage = observer(() => {
  const vaultService = useVaultService();
  const history = useHistory();
  const notePath = useNotePath();

  useEffect(() => {
    const toExecute = async () => {
      const result = await vaultService.getOrCreateDailyNote(dayjs());

      console.log({ result });

      if (result.status === 'ok') {
        history.replace(notePath(result.data.$modelId));
      }
    };

    toExecute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
});

export default DailyNotePage;
