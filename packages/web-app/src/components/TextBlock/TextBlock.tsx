import './styles.css';

import {
  BlocksScope,
  BlocksSelection,
  CollapsableBlock,
  getBlocksSelection,
  TextBlock,
} from '@harika/web-core';
import clsx from 'clsx';
import { computed } from 'mobx';
import { getSnapshot } from 'mobx-keystone';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useRef } from 'react';

import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { Arrow } from '../Arrow/Arrow';
import { useBacklinkedBlocksCount } from '../LinkedBlocksOfBlocksContext';
import { BlockEditor } from './BlockEditor/BlockEditor';
import { useFakeInput } from './BlockEditor/hooks/useFocusHandler';
import { TokensRenderer } from './TokensRenderer';

// IMPORTANT: don't use any global handlers in <NoteBlocksExtensionStore /> (document.addEventListener) cause it is slow down note blocks tree a lot

export const BlocksChildren = observer(
  ({
    parent,
    childBlocks,
    scope,
    blocksSelection,
  }: {
    parent: CollapsableBlock;
    childBlocks: CollapsableBlock[];
    scope: BlocksScope;
    blocksSelection: BlocksSelection;
  }) => {
    return childBlocks.length !== 0 ? (
      <>
        {childBlocks.map((block) =>
          block.originalBlock instanceof TextBlock ? (
            <TextBlockComponent
              blocksSelection={blocksSelection}
              key={block.$modelId}
              block={block as CollapsableBlock<TextBlock>}
              scope={scope}
            />
          ) : (
            <span>Unknown block</span>
          ),
        )}
      </>
    ) : null;
  },
);

//TODO: fix textarea performance
// Moved to separate component for performance reasons
const TextBlockBody = observer(
  ({
    block,
    scope,
    isExpanded,
  }: {
    block: CollapsableBlock<TextBlock>;
    scope: BlocksScope;
    isExpanded: boolean;
  }) => {
    const noteBlockBodyElRef = useRef<HTMLDivElement>(null);
    const fakeInputHolderRef = useRef<HTMLDivElement | null>(null);

    const { insertFakeInput, releaseFakeInput } =
      useFakeInput(fakeInputHolderRef);

    const [editState, setEditState] = useCurrentFocusedBlockState(
      scope.$modelId,
      block.$modelId,
    );
    const { isEditing } = editState;

    const handleToggle = useCallback(() => {
      scope.toggleExpand(block.$modelId);
    }, [block.$modelId, scope]);

    const contentLength = block.originalBlock.contentModel.currentValue.length;

    const handleContentClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        if (e.shiftKey) return;

        let startAt = contentLength;

        let { offset, node }: { offset: number; node: HTMLElement } = (() => {
          if ('caretRangeFromPoint' in document) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);

            return {
              offset: range?.startOffset || 0,
              node: range?.startContainer || e.target,
            };
          } else if ('caretPositionFromPoint' in document) {
            // @ts-ignore
            const range = document.caretPositionFromPoint(e.clientX, e.clientY);

            return {
              offset: range?.offset || 0,
              node: range?.offsetNode || e.target,
            };
          } else {
            return {
              offset: 0,
              node: e.target,
            };
          }
        })();

        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentNode as HTMLElement;
        }

        if (
          e.target instanceof HTMLElement &&
          e.target.closest('[data-not-editable]')
        )
          return;

        if (node.dataset.offsetStart) {
          startAt = parseInt(node.dataset.offsetStart, 10) + offset;
        }

        if (noteBlockBodyElRef.current) {
          insertFakeInput();
        }

        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: block.$modelId,
          isEditing: true,
          startAt,
        });
      },
      [
        contentLength,
        setEditState,
        scope.$modelId,
        block.$modelId,
        insertFakeInput,
      ],
    );

    const handleContentKeyPress = (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === 'Enter' && e.target === e.currentTarget) {
        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: block.$modelId,
          isEditing: true,
          startAt: 0,
        });
      }
    };

    return (
      <>
        {block.originalBlock.childrenBlocks.length !== 0 && (
          <Arrow
            className="text-block__arrow"
            isExpanded={isExpanded}
            onToggle={handleToggle}
          />
        )}

        <div
          ref={noteBlockBodyElRef}
          className={clsx('text-block__dot', {
            'text-block__dot--expanded': isExpanded,
          })}
        />
        {/* <div */}
        {/*   className={clsx('text-block__outline', { */}
        {/*     'text-block__outline--show': isFocused, */}
        {/*   })} */}
        {/* > */}

        <BlockEditor
          scope={scope}
          textBlock={block}
          insertFakeInput={insertFakeInput}
          releaseFakeInput={releaseFakeInput}
        />

        <span
          onMouseDown={handleContentClick}
          className={clsx('text-block__content', {
            'text-block__content--hidden': isEditing,
          })}
          role="textbox"
          aria-label="NoteModel block content"
          tabIndex={0}
          onKeyPress={handleContentKeyPress}
        >
          <TokensRenderer
            collapsableBlock={block}
            tokens={block.originalBlock.contentModel.ast}
          />
        </span>
        {/* </div> */}
      </>
    );
  },
);

export const TextBlockComponent = observer(
  ({
    block,
    scope,
    blocksSelection,
  }: {
    block: CollapsableBlock;
    scope: BlocksScope;
    blocksSelection: BlocksSelection;
  }) => {
    const isSelected = computed(() => {
      return blocksSelection.selectedBlockIds.includes(block.$modelId);
    }).get();

    const backlinksCount = useBacklinkedBlocksCount(block.$modelId);

    return (
      <div
        className="text-block"
        data-id={block.$modelId}
        data-order={block.originalBlock.orderPosition}
        data-type="text-block"
        data-scope-id={scope.$modelId}
      >
        <div
          className={clsx('text-block__body', {
            'text-block__body--selected': isSelected,
          })}
        >
          {block.originalBlock instanceof TextBlock ? (
            <TextBlockBody
              block={block as CollapsableBlock<TextBlock>}
              scope={scope}
              isExpanded={block.isExpanded}
            />
          ) : (
            <span> Unknown block</span>
          )}

          {backlinksCount > 0 && (
            <div className="text-block__linkedBlocksCounter">
              {backlinksCount}
            </div>
          )}
        </div>

        {block.children.length !== 0 && (
          <div
            className={clsx('text-block__child-blocks', {
              'text-block__child-blocks--selected': isSelected,
            })}
          >
            <BlocksChildren
              blocksSelection={blocksSelection}
              parent={block}
              childBlocks={block.childrenBlocks}
              scope={scope}
            />
          </div>
        )}
      </div>
    );
  },
);
