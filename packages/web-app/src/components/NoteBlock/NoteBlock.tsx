import React, { useCallback, useRef } from 'react';
import './styles.css';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import type { BlocksScope, ScopedBlock } from '@harika/web-core';
import { Arrow } from '../Arrow/Arrow';
import { computed } from 'mobx';
import { TokensRenderer } from './TokensRenderer';
import { useFakeInput } from './BlockEditor/hooks/useFocusHandler';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { BlockEditor } from './BlockEditor/BlockEditor';

// IMPORTANT: don't use any global handlers in <NoteBlock /> (document.addEventListener) cause it is slow down note blocks tree a lot

const NoteBlockChildren = observer(
  ({
    childBlocks,
    scope,
  }: {
    childBlocks: ScopedBlock[];
    scope: BlocksScope;
  }) => {
    return childBlocks.length !== 0 ? (
      <>
        {childBlocks.map((childNoteBlock) => (
          <NoteBlock
            key={childNoteBlock.$modelId}
            noteBlock={childNoteBlock}
            scope={scope}
          />
        ))}
      </>
    ) : null;
  },
);

//TODO: fix textarea performance
// Moved to separate component for performance reasons
const NoteBlockBody = observer(
  ({
    noteBlock,
    scope,
    isExpanded,
  }: {
    noteBlock: ScopedBlock;
    scope: BlocksScope;
    isExpanded: boolean;
  }) => {
    const noteBlockBodyElRef = useRef<HTMLDivElement>(null);
    const fakeInputHolderRef = useRef<HTMLDivElement | null>(null);

    const { insertFakeInput, releaseFakeInput } =
      useFakeInput(fakeInputHolderRef);

    const [editState, setEditState] = useCurrentFocusedBlockState(
      scope.$modelId,
      noteBlock.$modelId,
    );
    const { isEditing } = editState;

    const handleToggle = useCallback(() => {
      scope.toggleExpand(noteBlock.$modelId);
    }, [noteBlock.$modelId, scope]);

    const contentLength = noteBlock.content.currentValue.length;

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
              parseInt(e.target.dataset.offsetStart, 10) +
              (range?.startOffset || 0);
          }

          if (noteBlockBodyElRef.current) {
            insertFakeInput();
          }
        }

        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: noteBlock.$modelId,
          isEditing: true,
          startAt,
        });
      },
      [
        contentLength,
        setEditState,
        scope.$modelId,
        noteBlock.$modelId,
        insertFakeInput,
      ],
    );

    const handleContentKeyPress = (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === 'Enter' && e.target === e.currentTarget) {
        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: noteBlock.$modelId,
          isEditing: true,
          startAt: 0,
        });
      }
    };

    return (
      <>
        {noteBlock.notCollapsedChildren.length !== 0 && (
          <Arrow
            className="note-block__arrow"
            isExpanded={isExpanded}
            onToggle={handleToggle}
          />
        )}

        <div
          ref={noteBlockBodyElRef}
          className={clsx('note-block__dot', {
            'note-block__dot--expanded': isExpanded,
          })}
        />
        {/* <div */}
        {/*   className={clsx('note-block__outline', { */}
        {/*     'note-block__outline--show': isFocused, */}
        {/*   })} */}
        {/* > */}

        <BlockEditor
          scope={scope}
          noteBlock={noteBlock}
          insertFakeInput={insertFakeInput}
          releaseFakeInput={releaseFakeInput}
        />

        <span
          onMouseDown={handleContentClick}
          className={clsx('note-block__content', {
            'note-block__content--hidden': isEditing,
          })}
          role="textbox"
          aria-label="NoteModel block content"
          tabIndex={0}
          onKeyPress={handleContentKeyPress}
        >
          <TokensRenderer
            noteBlock={noteBlock}
            tokens={noteBlock.content.ast}
          />
        </span>
        {/* </div> */}
      </>
    );
  },
);

export const NoteBlock = observer(
  ({ noteBlock, scope }: { noteBlock: ScopedBlock; scope: BlocksScope }) => {
    const isSelected = computed(() => {
      return scope.selectedIds.includes(noteBlock.$modelId);
    }).get();

    return (
      <div
        className="note-block"
        data-id={noteBlock.$modelId}
        data-order={noteBlock.orderPosition}
        data-type="note-block"
        data-scope-id={scope.$modelId}
      >
        <div
          className={clsx('note-block__body', {
            'note-block__body--selected': isSelected,
          })}
        >
          <NoteBlockBody
            noteBlock={noteBlock}
            scope={scope}
            isExpanded={noteBlock.isExpanded}
          />
        </div>

        {noteBlock.children.length !== 0 && (
          <div
            className={clsx('note-block__child-blocks', {
              'note-block__child-blocks--selected': isSelected,
            })}
          >
            <NoteBlockChildren childBlocks={noteBlock.children} scope={scope} />
          </div>
        )}
      </div>
    );
  },
);
