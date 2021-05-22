import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useHistory } from 'react-router-dom';
import { useNoteRepository } from '../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../hooks/useCurrentVault';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';
import { observer } from 'mobx-react-lite';
import { paths } from '../paths';

export const DailyNotePage = observer(() => {
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();
  const history = useHistory();
  const vaultUiState = useCurrentVaultUiState();

  useEffect(() => {
    const toExecute = async () => {
      const result = await noteRepo.getOrCreateDailyNote(dayjs());

      if (result.status === 'ok') {
        vaultUiState.setCurrentNoteId(result.data.$modelId);

        history.replace(
          paths.vaultNotePath({
            vaultId: vault.$modelId,
            noteId: result.data.$modelId,
          }),
        );
      }
    };

    toExecute();
  }, [history, vault.$modelId, noteRepo, vaultUiState]);

  return null;
});

export default DailyNotePage;
