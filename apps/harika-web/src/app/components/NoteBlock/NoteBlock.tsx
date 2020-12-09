import withObservables from '@nozbe/with-observables';
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import './styles.css';
import { useClickAway } from 'react-use';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { CurrentEditContext } from '../CurrentEditContent';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';

type InputProps = { noteBlock: NoteBlockModel };

export const NoteBlockComponent = ({
  noteBlock,
  childBlocks,
}: InputProps & { childBlocks: NoteBlockModel[] }) => {
  const database = useDatabase();
  const [editState, setEditState] = useContext(CurrentEditContext);
  const [content, setContent] = useState(noteBlock.content);
  const isEditing = editState?.id === noteBlock.id;

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useClickAway(inputRef, () => {
    if (isEditing) {
      setEditState(undefined);
    }
  });

  useEffect(() => {
    setContent(noteBlock.content);
  }, [noteBlock.content]);

  useEffect(() => {
    if (noteBlock.content === content) return;

    database.action(async () => {
      await noteBlock.update((post) => {
        post.content = content;
      });
    });
  }, [content, database, noteBlock]);

  const handleKeyPress = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const newBlock = await noteBlock.injectNewRightBlock('');

        setEditState({
          id: newBlock.id,
        });
      }
    },
    [setEditState, noteBlock]
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Backspace') {
        const { currentTarget } = e;

        const isOnStart =
          currentTarget.selectionStart === currentTarget.selectionEnd &&
          currentTarget.selectionStart === 0;

        if (isOnStart) {
          e.preventDefault();

          const mergedTo = await noteBlock.mergeToLeftAndDelete();

          if (mergedTo) {
            setEditState({
              id: mergedTo.id,
            });
          }
        }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();

        await noteBlock.tryMoveUp();
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();

        await noteBlock.tryMoveDown();
      } else if (e.key === 'ArrowDown') {
        const [, right] = await noteBlock.getLeftAndRight();

        if (right) {
          setEditState({
            id: right.id,
          });
        }
      } else if (e.key === 'ArrowUp') {
        const [left] = await noteBlock.getLeftAndRight();

        if (left) {
          setEditState({ id: left.id });
        }
      }
    },
    [noteBlock, setEditState]
  );

  return (
    <div className="note-block">
      <div className="note-block__body">
        <div className="note-block__dot" />({noteBlock.order})
        {isEditing ? (
          <TextareaAutosize
            ref={inputRef}
            className="note-block__input"
            value={content}
            autoFocus
            onChange={(e) => setContent(e.target.value)}
            onKeyPress={handleKeyPress}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div
            className="note-block__content"
            onClick={() =>
              setEditState({
                id: noteBlock.id,
              })
            }
          >
            {content}
          </div>
        )}
      </div>
      {childBlocks.length !== 0 && (
        <div className="note-block__child-blocks">
          {childBlocks
            .sort((a, b) => a.order - b.order)
            .map((childNoteBlock) => (
              <NoteBlock key={childNoteBlock.id} noteBlock={childNoteBlock} />
            ))}
        </div>
      )}
    </div>
  );
};

const enhance = withObservables(['noteBlock'], ({ noteBlock }) => ({
  noteBlock,
  childBlocks: noteBlock.childBlocks,
}));

export const NoteBlock = enhance(NoteBlockComponent) as React.FC<InputProps>;
