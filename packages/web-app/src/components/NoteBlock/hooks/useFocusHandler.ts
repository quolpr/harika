import { useRef, useCallback, useEffect, RefObject } from 'react';
import { useCurrentFocusedBlockState } from '../../../hooks/useFocusedBlockState';
import type {
  BlocksScope,
  BlocksViewModel,
  NoteBlockModel,
} from '@harika/web-core';

// https://stackoverflow.com/a/55652503/3872807
const useFakeInput = () => {
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

// Handle iOS DONE button on keyboard
// const useHandleDoneIosButton = (
//   view: BlocksViewModel,
//   noteBlock: NoteBlockModel,
// ) => {
//   const [wasBlurred, setWasBlurred] = useState(false);

//   const [editState, setEditState] = useCurrentFocusedBlockState(
//     view.$modelId,
//     noteBlock.$modelId,
//   );

//   const { isEditing } = editState;

//   const handleBlur = useCallback((e) => {
//     setWasBlurred(true);
//   }, []);

//   // When `Done` button clicked on iOS keybaord
//   useEffect(() => {
//     if (wasBlurred && isEditing) {
//       // setEditState({
//       //   viewId: view.$modelId,
//       //   blockId: noteBlock.$modelId,
//       //   isEditing: false,
//       // });
//     }
//     setWasBlurred(false);
//   }, [wasBlurred, isEditing, setEditState, view.$modelId, noteBlock.$modelId]);

//   return handleBlur;
// };

export const useFocusHandler = (
  scope: BlocksScope,
  blockView: BlocksViewModel,
  inputRef: RefObject<HTMLTextAreaElement | null>,
  noteBlockElRef: RefObject<HTMLDivElement | null>,
) => {
  const [editState, setEditState] = useCurrentFocusedBlockState(
    scope.$modelId,
    blockView.$modelId,
  );

  const { isFocused, startAt, isEditing } = editState;

  const { insertFakeInput, releaseFakeInput, fakeInputRef } = useFakeInput();

  const contentLength = blockView.content.value.length;

  useEffect(() => {
    if (
      isEditing &&
      inputRef.current &&
      document.activeElement !== inputRef.current
    ) {
      if (!inputRef.current) return;

      const posAt = (() =>
        startAt !== undefined ? startAt : blockView.content.value.length)();

      inputRef.current.focus();

      inputRef.current.selectionStart = posAt;
      inputRef.current.selectionEnd = posAt;

      releaseFakeInput();
    }
  }, [
    isFocused,
    isEditing,
    startAt,
    blockView.content.value.length,
    releaseFakeInput,
    inputRef,
  ]);

  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();

      if (e.shiftKey) return;

      let startAt = contentLength;

      if (e.target instanceof HTMLElement) {
        if (e.target.dataset.notEditable) return;

        // TODO: no FF support
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);

        if (e.target.dataset.offsetStart) {
          startAt =
            parseInt(e.target.dataset.offsetStart, 10) + range.startOffset;
        }

        if (noteBlockElRef.current) {
          insertFakeInput(noteBlockElRef.current);
        }
      }

      setEditState({
        scopeId: scope.$modelId,
        viewId: blockView.$modelId,
        isEditing: true,
        startAt,
      });
    },
    [
      contentLength,
      insertFakeInput,
      blockView.$modelId,
      noteBlockElRef,
      scope.$modelId,
      setEditState,
    ],
  );

  const handleContentKeyPress = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) {
      setEditState({
        scopeId: scope.$modelId,
        viewId: blockView.$modelId,
        isEditing: true,
        startAt: 0,
      });
    }
  };

  const handleInputBlur = useCallback(() => {}, []);

  return {
    handleInputBlur,
    handleContentClick,
    handleContentKeyPress,
    insertFakeInput,
    releaseFakeInput,
    fakeInputRef,
  };
};
