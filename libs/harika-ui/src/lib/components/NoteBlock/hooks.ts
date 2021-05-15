import {
  useRef,
  useCallback,
  useEffect,
  MutableRefObject,
  useContext,
  useState,
} from 'react';
import { CurrentBlockInputRefContext } from '../../contexts';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { BlocksViewModel, NoteBlockModel } from '@harika/harika-front-core';

// https://stackoverflow.com/a/55652503/3872807
export const useFakeInput = () => {
  const fakeInputRef = useRef<HTMLInputElement | null>(null);

  const insertFakeInput = useCallback((el?: HTMLElement) => {
    // create invisible dummy input to receive the focus first
    const fakeInput = document.createElement('input');
    fakeInput.setAttribute('type', 'text');
    fakeInput.style.position = 'absolute';
    fakeInput.style.fontSize = '16px'; // disable auto zoom
    fakeInput.style.width = '5px';
    fakeInput.style.height = '5px';
    fakeInput.style.opacity = '0.1';
    fakeInput.style.backgroundColor = '#000';

    // you may need to append to another element depending on the browser's auto
    // zoom/scroll behavior
    (el || document.body).prepend(fakeInput);

    // focus so that subsequent async focus will work
    fakeInput.focus();
    fakeInputRef.current = fakeInput;
    // Fake input end
  }, []);

  const releaseFakeInput = useCallback(() => {
    if (fakeInputRef.current) {
      fakeInputRef.current.remove();
      fakeInputRef.current = null;
    }
  }, []);

  useEffect(() => releaseFakeInput, [releaseFakeInput]);

  return { insertFakeInput, releaseFakeInput, fakeInputRef };
};

export const usePassCurrentInput = (
  inputRef: MutableRefObject<HTMLTextAreaElement | null>,
  isEditing: boolean
) => {
  const currentBlockInputRef = useContext(CurrentBlockInputRefContext);

  useEffect(() => {
    if (isEditing) {
      currentBlockInputRef.current = inputRef.current;
    } else {
      if (currentBlockInputRef.current === inputRef.current) {
        currentBlockInputRef.current = null;
      }
    }
  }, [currentBlockInputRef, inputRef, isEditing]);
};

// Handle iOS DONE button on keyboard
export const useHandleDoneIosButton = (
  view: BlocksViewModel,
  noteBlock: NoteBlockModel
) => {
  const [wasBlurred, setWasBlurred] = useState(false);

  const [editState, setEditState] = useCurrentFocusedBlockState(
    view.$modelId,
    noteBlock.$modelId
  );

  const { isEditing } = editState;

  const handleBlur = useCallback(() => {
    setWasBlurred(true);
  }, []);

  // When `Done` button clicked on iOS keybaord
  useEffect(() => {
    if (wasBlurred && isEditing) {
      setEditState({
        viewId: view.$modelId,
        blockId: noteBlock.$modelId,
        isEditing: false,
      });
    }
    setWasBlurred(false);
  }, [wasBlurred, isEditing, setEditState, view.$modelId, noteBlock.$modelId]);

  return handleBlur;
};
