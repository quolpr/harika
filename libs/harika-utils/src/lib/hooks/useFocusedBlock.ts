import { useContext } from 'use-context-selector';
import { CurrentFocusedBlockContext } from '../contexts/CurrentFocusedBlockContext';

export const useFocusedBlock = () => {
  const [noteBlockState] = useContext(CurrentFocusedBlockContext);

  return noteBlockState;
};
