import React, { useCallback, useRef } from 'react';
import './styles.css';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import { observer } from 'mobx-react-lite';
import type { BlocksViewModel, NoteBlockModel } from '@harika/web-core';
import { Arrow } from '../Arrow/Arrow';
import { computed } from 'mobx';
import type { Ref } from 'mobx-keystone';
import { TokensRenderer } from './TokensRenderer';
import {
  useProvideInputToContext,
  useUpdateBlockLinks,
} from './hooks/otherHooks';
import { useFocusHandler } from './hooks/useFocusHandler';
import { useHandleInput } from './hooks/useHandleInput';
import { NoteTitleAutocomplete } from './NoteTitleAutocomplete/NoteTitleAutocomplete';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { xor } from 'lodash-es';

const NoteBlockChildren = observer(
  ({
    childBlocks,
    view,
  }: {
    childBlocks: Ref<NoteBlockModel>[];
    view: BlocksViewModel;
  }) => {
    return childBlocks.length !== 0 ? (
      <>
        {childBlocks.map((childNoteBlock) => (
          <NoteBlock
            key={childNoteBlock.current.$modelId}
            noteBlock={childNoteBlock.current}
            view={view}
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
    view,
    isExpanded,
  }: {
    noteBlock: NoteBlockModel;
    view: BlocksViewModel;
    isExpanded: boolean;
  }) => {
    const noteBlockBodyElRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    const [editState] = useCurrentFocusedBlockState(
      view.$modelId,
      noteBlock.$modelId,
    );
    const { isEditing } = editState;
    useProvideInputToContext(inputRef, isEditing);
    useUpdateBlockLinks(noteBlock, editState);
    const {
      handleInputBlur,
      insertFakeInput,
      releaseFakeInput,
      handleContentClick,
      handleContentKeyPress,
    } = useFocusHandler(view, noteBlock, inputRef, noteBlockBodyElRef);
    const { textareaHandlers, noteTitleToSearch, handleSearchSelect } =
      useHandleInput(
        noteBlock,
        view,
        noteBlockBodyElRef,
        inputRef,
        insertFakeInput,
        releaseFakeInput,
      );

    const handleToggle = useCallback(() => {
      view.toggleExpand(noteBlock.$modelId);
    }, [noteBlock.$modelId, view]);

    const inputId = `${view.$modelId}-${noteBlock.$modelId}`;

    const isSelected = computed(() =>
      view.selectedIds.includes(noteBlock.$modelId),
    ).get();

    return (
      <div
        className={clsx('note-block__body', {
          'note-block__body--selected': isSelected,
        })}
        ref={noteBlockBodyElRef}
      >
        {noteBlock.noteBlockRefs.length !== 0 && (
          <Arrow
            className="note-block__arrow"
            isExpanded={isExpanded}
            onToggle={handleToggle}
          />
        )}

        <div
          className={clsx('note-block__dot', {
            'note-block__dot--expanded': isExpanded,
          })}
        />
        {/* <div */}
        {/*   className={clsx('note-block__outline', { */}
        {/*     'note-block__outline--show': isFocused, */}
        {/*   })} */}
        {/* > */}
        <div
          className={clsx('note-block__input-container', {
            'note-block__input-container--hidden': !isEditing,
          })}
        >
          <label htmlFor={inputId} className="hidden-label">
            Note block content
          </label>

          <TextareaAutosize
            id={inputId}
            ref={inputRef}
            className={clsx('note-block__content', {})}
            value={noteBlock.content.value}
            onBlur={handleInputBlur}
            {...textareaHandlers}
          />
          <NoteTitleAutocomplete
            value={noteTitleToSearch}
            onSelect={handleSearchSelect}
          />
        </div>

        <span
          onMouseDown={handleContentClick}
          className={clsx('note-block__content', {
            'note-block__content--hidden': isEditing,
          })}
          role="textbox"
          aria-label="Note block content"
          tabIndex={0}
          onKeyPress={handleContentKeyPress}
        >
          <TokensRenderer
            noteBlock={noteBlock}
            tokens={noteBlock.content.ast}
          />
        </span>
        {/* </div> */}
      </div>
    );
  },
);

export const NoteBlock = observer(
  ({
    noteBlock,
    view,
  }: {
    noteBlock: NoteBlockModel;
    view: BlocksViewModel;
  }) => {
    const isExpanded = computed(() =>
      view.isExpanded(noteBlock.$modelId),
    ).get();

    const areChildrenAndParentSelected = computed(() => {
      const childBlockIds = noteBlock.flattenTree.map(
        ({ $modelId }) => $modelId,
      );
      const selectedIds = view.selectedIds;

      if (childBlockIds.length === 0) return false;

      return [noteBlock.$modelId, ...childBlockIds].every((id) =>
        selectedIds.includes(id),
      );
    }).get();

    return (
      <div
        className="note-block"
        data-view-id={view.$modelId}
        data-id={noteBlock.$modelId}
        data-order={noteBlock.orderPosition}
        data-type="note-block"
      >
        <NoteBlockBody
          noteBlock={noteBlock}
          view={view}
          isExpanded={isExpanded}
        />

        {isExpanded && noteBlock.noteBlockRefs.length !== 0 && (
          <div
            className={clsx('note-block__child-blocks', {
              'note-block__child-blocks--selected':
                areChildrenAndParentSelected,
            })}
          >
            <NoteBlockChildren
              childBlocks={noteBlock.noteBlockRefs}
              view={view}
            />
          </div>
        )}
      </div>
    );
  },
);
