import withObservables from '@nozbe/with-observables';
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import NoteBlockModel from '../../../model/NoteBlock';
import TextareaAutosize from 'react-textarea-autosize';

import './styles.css';
import { useClickAway } from 'react-use';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { TableName } from 'apps/harika-web/src/model/schema';
import { CurrentEditContext } from '../CurrentEditContent';
import { Q } from '@nozbe/watermelondb';

type InputProps = { noteBlock: NoteBlockModel };

export const NoteBlockComponent = ({
  noteBlock,
  childBlocks,
}: InputProps & { childBlocks: NoteBlockModel[] }) => {
  const database = useDatabase();
  const [editState, setEditState] = useContext(CurrentEditContext);
  const [content, setContent] = useState(noteBlock.content);
  const isEditing =
    editState?.id === noteBlock.id && editState.type === TableName.NOTE_BLOCKS;

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
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        database.action(async () => {
          const parentBlock = await noteBlock.parentBlock.fetch();
          const children = await parentBlock?.childBlocks
            .extend(Q.where('order', Q.gt(noteBlock.order)))
            .fetch();

          children?.forEach((block) => {
            block.update((modification) => {
              modification.order = modification.order + 1;
            });
          });

          const newBlock = await database.collections
            .get<NoteBlockModel>(TableName.NOTE_BLOCKS)
            .create((block) => {
              block.note_id = noteBlock.note_id;
              block.parent_block_id = noteBlock.parent_block_id;
              block.content = '';
              block.order = noteBlock.order + 1;
            });

          setEditState({ id: newBlock.id, type: TableName.NOTE_BLOCKS });
        });
      }
    },
    [
      setEditState,
      database,
      noteBlock.note_id,
      noteBlock.order,
      noteBlock.parent_block_id,
      noteBlock.parentBlock,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Backspace') {
        const { currentTarget } = e;

        const isOnStart =
          currentTarget.selectionStart === currentTarget.selectionEnd &&
          currentTarget.selectionStart === 0;

        if (isOnStart) {
          e.preventDefault();

          database.action(async () => {
            const parentBlock = await noteBlock.parentBlock.fetch();
            const children = (await parentBlock?.childBlocks.fetch())?.sort(
              (a, b) => a.order - b.order
            );

            if (!children) return;

            const index = children.findIndex((ch) => noteBlock.id === ch.id);

            const sibling = children[index - 1];

            sibling.update((record) => {
              record.content = record.content + noteBlock.content;
            });

            setEditState({ id: sibling.id, type: TableName.NOTE_BLOCKS });

            await noteBlock.markAsDeleted();
          });
        }
      }
    },
    [database, noteBlock, setEditState]
  );

  return (
    <div className="note-block">
      <div className="note-block__body">
        <div className="note-block__dot" />
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
              setEditState({ type: TableName.NOTE_BLOCKS, id: noteBlock.id })
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
