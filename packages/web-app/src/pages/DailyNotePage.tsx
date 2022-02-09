import { useEffect } from 'react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useNotePath } from '../contexts/StackedNotesContext';
import { useNoteBlocksService } from '../hooks/vaultAppHooks';

export const DailyNotePage = observer(() => {
  const noteBlocksService = useNoteBlocksService();
  const navigate = useNavigate();
  const notePath = useNotePath();

  useEffect(() => {
    const toExecute = async () => {
      const result = await noteBlocksService.getOrCreateDailyNote(dayjs());

      console.log({ result });

      if (result.status === 'ok') {
        navigate(notePath(result.data.$modelId), { replace: true });
      }
    };

    toExecute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
});

export default DailyNotePage;
