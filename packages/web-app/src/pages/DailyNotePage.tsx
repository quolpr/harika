import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHistory } from 'react-router-dom';
import { useNotesService } from '../contexts/CurrentNotesServiceContext';
import { useCurrentVault } from '../hooks/useCurrentVault';
import { observer } from 'mobx-react-lite';
import { paths } from '../paths';

export const DailyNotePage = observer(() => {
  const vault = useCurrentVault();
  const noteRepo = useNotesService();
  const history = useHistory();

  useEffect(() => {
    const toExecute = async () => {
      const result = await noteRepo.getOrCreateDailyNote(dayjs());

      if (result.status === 'ok') {
        history.replace(
          paths.vaultNotePath({
            vaultId: vault.$modelId,
            noteId: result.data.$modelId,
          }),
        );
      }
    };

    toExecute();
  }, [history, vault.$modelId, noteRepo, vault.ui]);

  return null;
});

export default DailyNotePage;
