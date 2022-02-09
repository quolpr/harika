import { RefObject,useCallback, useEffect, useRef } from 'react';

// https://stackoverflow.com/a/55652503/3872807
export const useFakeInput = (el: RefObject<HTMLElement | null>) => {
  const fakeInputRef = useRef<HTMLInputElement | null>(null);

  const insertFakeInput = useCallback(() => {
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
    (el.current || document.body).prepend(fakeInput);

    // focus so that subsequent async focus will work
    fakeInput.focus();
    fakeInputRef.current = fakeInput;
    // Fake input end
  }, [el]);

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
//   view: ScopedBlock,
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
//       //   scopedBlockId: view.$modelId,
//       //   blockId: noteBlock.$modelId,
//       //   isEditing: false,
//       // });
//     }
//     setWasBlurred(false);
//   }, [wasBlurred, isEditing, setEditState, view.$modelId, noteBlock.$modelId]);

//   return handleBlur;
// };
