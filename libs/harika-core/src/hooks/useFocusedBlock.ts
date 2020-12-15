import { useContext } from 'use-context-selector';
import { CurrentFocusedBlockContext } from '../contexts/CurrentEditContent';

export const useFocusedBlock = () => {
  const [noteBlockState] = useContext(CurrentFocusedBlockContext);

  return noteBlockState;
};
