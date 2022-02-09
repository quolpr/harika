import dayjs from 'dayjs';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import { useNotePath } from '../contexts/StackedNotesContext';
import { useNoteBlocksService } from '../hooks/vaultAppHooks';
import { useNavigateRef } from '../utils';

export const DailyNotePage = observer(() => {
  const noteBlocksService = useNoteBlocksService();
  const navigate = useNavigateRef();
  const notePath = useNotePath();

  useEffect(() => {
    const toExecute = async () => {
      const result = await noteBlocksService.getOrCreateDailyNote(dayjs());

      console.log({ result });

      if (result.status === 'ok') {
        navigate.current(notePath(result.data.$modelId), { replace: true });
      }
    };

    toExecute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
});

export default DailyNotePage;
