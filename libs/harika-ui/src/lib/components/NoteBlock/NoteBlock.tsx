import React, { useCallback, useRef } from 'react';
import './styles.css';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import { observer } from 'mobx-react-lite';
import { BlocksViewModel, NoteBlockModel } from '@harika/harika-front-core';
import { Arrow } from '../Arrow/Arrow';
import { computed } from 'mobx';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { Ref } from 'mobx-keystone';
import { TokensRenderer } from './TokensRenderer';
import {
  useProvideInputToContext,
  useUpdateBlockLinks,
} from './hooks/otherHooks';
import { useFocusHandler } from './hooks/useFocusHandler';
import { useHandleInput } from './hooks/useHandleInput';
import { NoteTitleAutocomplete } from './NoteTitleAutocomplete';

const NoteBlockChildren = observer(
  ({
    childBlocks,
    view,
  }: {
    childBlocks: Ref<NoteBlockModel>[];
    view: BlocksViewModel;
  }) => {
    return childBlocks.length !== 0 ? (
      <div className="note-block__child-blocks">
        {childBlocks.map((childNoteBlock) => (
          <NoteBlock
            key={childNoteBlock.current.$modelId}
            noteBlock={childNoteBlock.current}
            view={view}
          />
        ))}
      </div>
    ) : null;
  }
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
      noteBlock.$modelId
    );
    const { isFocused, isEditing } = editState;
    useProvideInputToContext(inputRef, isEditing);
    useUpdateBlockLinks(noteBlock, editState);
    const {
      handleInputBlur,
      insertFakeInput,
      releaseFakeInput,
      handleContentClick,
    } = useFocusHandler(view, noteBlock, inputRef, noteBlockBodyElRef);
    const {
      handleKeyPress,
      handleKeyDown,
      handleChange,
      noteTitleToSearch,
    } = useHandleInput(
      noteBlock,
      view,
      noteBlockBodyElRef,
      insertFakeInput,
      releaseFakeInput
    );

    const handleToggle = useCallback(() => {
      view.toggleExpand(noteBlock.$modelId);
    }, [noteBlock.$modelId, view]);

    return (
      <div className="note-block__body" ref={noteBlockBodyElRef}>
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
        {isEditing && (
          <>
            <TextareaAutosize
              ref={inputRef}
              className={clsx('note-block__content', {
                'note-block__content--hidden': !isEditing,
              })}
              onKeyDown={handleKeyDown}
              onKeyPress={handleKeyPress}
              onChange={handleChange}
              value={noteBlock.content.value}
              onBlur={handleInputBlur}
            />
            <NoteTitleAutocomplete value={noteTitleToSearch} />
          </>
        )}
        {!isEditing && (
          <span
            onClick={handleContentClick}
            className={clsx('note-block__content', {
              'note-block__content--focused': isFocused,
            })}
          >
            <TokensRenderer
              noteBlock={noteBlock}
              tokens={noteBlock.content.ast}
            />
          </span>
        )}
        {/* </div> */}
      </div>
    );
  }
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
      view.isExpanded(noteBlock.$modelId)
    ).get();

    return (
      <div
        className="note-block"
        data-id={noteBlock.$modelId}
        data-order={noteBlock.orderPosition}
        data-type="note-block"
      >
        <NoteBlockBody
          noteBlock={noteBlock}
          view={view}
          isExpanded={isExpanded}
        />

        {isExpanded && (
          <NoteBlockChildren
            childBlocks={noteBlock.noteBlockRefs}
            view={view}
          />
        )}
      </div>
    );
  }
);
