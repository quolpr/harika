import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHistory } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useCurrentVaultApp, useVaultService } from '../hooks/vaultAppHooks';
import { useNotePath } from '../contexts/StackedNotesContext';

export const DailyNotePage = observer(() => {
  const vaultApp = useCurrentVaultApp();
  const vaultService = useVaultService();
  const history = useHistory();
  const notePath = useNotePath();

  useEffect(() => {
    const toExecute = async () => {
      const result = await vaultService.getOrCreateDailyNote(dayjs());

      if (result.status === 'ok') {
        history.replace(notePath(result.data.$modelId));
      }
    };

    toExecute();
  }, [history, vaultService, vaultApp.applicationId, notePath]);

  return null;
});

export default DailyNotePage;
