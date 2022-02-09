import { ModelCreationData, standaloneAction } from 'mobx-keystone';
import { Optional } from 'utility-types';

import { isTodo } from '../../../../lib/blockParser/astHelpers';
import { generateId } from '../../../../lib/generateId';
import { BaseBlock, blockRef } from './BaseBlock';
import { BlocksStore } from './BlocksStore';
import { CollapsableBlock } from './CollapsableBlock';
import { TextBlock } from './TextBlock';

export const createTextBlock = standaloneAction(
  'harika/BlocksExtension/BlocksStore/createTextBlock',
  (
    blocksStore: BlocksStore,
    data: Optional<
      ModelCreationData<TextBlock>,
      'createdAt' | 'updatedAt' | 'id'
    >,
  ) => {
    const time = new Date().getTime();

    const newTextBlock = new TextBlock({
      id: generateId(),
      createdAt: time,
      updatedAt: time,
      areChildrenLoaded: true,
      ...data,
    });

    blocksStore.registerBlock(newTextBlock);

    return newTextBlock;
  },
);

export const injectNewLeftBlock = standaloneAction(
  'harika/BlocksExtension/BlocksStore/injectNewLeftBlock',
  (
    blocksStore: BlocksStore,
    collapsableBlock: CollapsableBlock,
    content: string,
  ) => {
    if (!collapsableBlock.parent) {
      throw new Error('Parent must be present!');
    }
    const newOrderPosition = collapsableBlock.originalBlock.orderPosition;

    collapsableBlock.originalBlock.increaseSiblingsPosition(newOrderPosition);

    return createTextBlock(blocksStore, {
      content,
      orderPosition: newOrderPosition,
      parentRef: blockRef(collapsableBlock.parent.$modelId),
    });
  },
);

export const injectNewRightBlock = standaloneAction(
  'harika/BlocksExtension/BlocksStore/injectNewRightBlock',
  (
    blocksStore: BlocksStore,
    collapsableBlock: CollapsableBlock,
    content: string,
  ) => {
    if (!collapsableBlock.parent) {
      throw new Error("Can't inject from root block");
    }

    const { injectTo, parentBlock } = (() => {
      if (collapsableBlock.children.length > 0 && content.length === 0) {
        return {
          injectTo: 0,
          parentBlock: collapsableBlock.originalBlock,
        };
      } else if (collapsableBlock.children.length > 0 && content.length !== 0) {
        return {
          injectTo: 0,
          parentBlock: collapsableBlock.originalBlock,
        };
      } else {
        return {
          injectTo: collapsableBlock.originalBlock.orderPosition + 1,
          parentBlock: collapsableBlock.parent.originalBlock,
        };
      }
    })();

    collapsableBlock.originalBlock.increaseSiblingsPosition(injectTo);

    return createTextBlock(blocksStore, {
      content,
      parentRef: blockRef(parentBlock),
      orderPosition: injectTo,
    });
  },
);

export const handleNewLinePress = standaloneAction(
  'harika/BlocksExtension/BlocksStore/handleNewLinePress',
  (
    blocksStore: BlocksStore,
    collapsableBlock: CollapsableBlock<TextBlock>,
    caretPosStart: number,
  ) => {
    const { originalBlock } = collapsableBlock;
    const content = originalBlock.contentModel.currentValue;

    let newContent = '';
    let startAt = 0;
    let newBlock: TextBlock | undefined = undefined;
    let focusOn: TextBlock | undefined = undefined;

    if (caretPosStart === 0 && content.length !== 0) {
      newBlock = injectNewLeftBlock(blocksStore, collapsableBlock, newContent);
      focusOn = newBlock;
    } else if (
      caretPosStart > 0 &&
      caretPosStart !== content.length &&
      collapsableBlock.children.length > 0
    ) {
      newBlock = injectNewLeftBlock(
        blocksStore,
        collapsableBlock,
        content.slice(0, caretPosStart),
      );
      originalBlock.setContent(content.slice(caretPosStart, content.length));

      focusOn = this;
    } else {
      if (caretPosStart !== content.length) {
        newContent = content.slice(caretPosStart, content.length);

        originalBlock.setContent(content.slice(0, caretPosStart));
      }

      const firstChild: BaseBlock | undefined =
        collapsableBlock.children[0]?.originalBlock;

      if (
        (originalBlock.contentModel.hasTodo ||
          (firstChild &&
            firstChild instanceof TextBlock &&
            firstChild.contentModel.hasTodo)) &&
        newContent.length === 0
      ) {
        newContent = '[[TODO]] ';
        startAt = newContent.length;
      }

      newBlock = injectNewRightBlock(blocksStore, collapsableBlock, newContent);
      focusOn = newBlock;
    }

    return { focusStartAt: startAt, focusOn, newBlock };
  },
);

export const toggleTodo = standaloneAction(
  'harika/BlocksExtension/TextBlock/toggleTodo',
  (
    textBlock: TextBlock,
    collapsableBlock: CollapsableBlock,
    id: string,
    toggledModels: CollapsableBlock[] = [],
  ): CollapsableBlock[] => {
    const token = textBlock.contentModel.getTokenById(id);

    if (!token || !isTodo(token)) return [];

    if (textBlock.contentModel.firstTodoToken?.id === id) {
      collapsableBlock.children.forEach((block) => {
        if (!(block.originalBlock instanceof TextBlock)) return;

        const firstTodo = textBlock.contentModel.firstTodoToken;

        if (firstTodo && firstTodo.ref === token.ref)
          toggleTodo(block.originalBlock, block, firstTodo.id, toggledModels);
      });
    }

    textBlock.contentModel.toggleTodo(id);

    toggledModels.push(collapsableBlock);

    return toggledModels;
  },
);
