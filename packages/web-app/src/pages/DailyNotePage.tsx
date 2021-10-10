import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHistory } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { paths } from '../paths';
import { useCurrentVaultApp, useVaultService } from '../hooks/vaultAppHooks';

export const DailyNotePage = observer(() => {
  const vaultApp = useCurrentVaultApp();
  const vaultService = useVaultService();
  const history = useHistory();

  useEffect(() => {
    const toExecute = async () => {
      const result = await vaultService.getOrCreateDailyNote(dayjs());

      if (result.status === 'ok') {
        history.replace(
          paths.vaultNotePath({
            vaultId: vaultApp.applicationId,
            noteId: result.data.$modelId,
          }),
        );
      }
    };

    toExecute();
  }, [history, vaultService, vaultApp.applicationId]);

  return null;
});

export default DailyNotePage;
