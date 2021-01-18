import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHistory } from 'react-router-dom';
import { paths } from '../paths';
import { useNoteRepository } from '../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../hooks/useCurrentVault';

export const MainPageRedirect = () => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const history = useHistory();

  useEffect(() => {
    const toExecute = async () => {
      const result = await noteRepo.getOrCreateDailyNote(vault, dayjs());

      if (result.status === 'ok') {
        history.replace(
          paths.vaultNotePath({
            vaultId: vault.$modelId,
            noteId: result.data.$modelId,
          })
        );
      }
    };

    toExecute();
  }, [history, vault, noteRepo]);

  return null;
};
