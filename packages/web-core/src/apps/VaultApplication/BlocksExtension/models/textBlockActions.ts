import { ModelCreationData, standaloneAction } from 'mobx-keystone';
import { Optional } from 'utility-types';

import { isTodo } from '../../../../lib/blockParser/astHelpers';
import { generateId } from '../../../../lib/generateId';
import { BaseBlock, blockRef } from './BaseBlock';
import { BlocksStore } from './BlocksStore';
import { BlockView } from '../../BlockViewsExtension/models/BlockView';
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
  (blocksStore: BlocksStore, blockView: BlockView, content: string) => {
    if (!blockView.parent) {
      throw new Error('Parent must be present!');
    }
    const newOrderPosition = blockView.originalBlock.orderPosition;

    blockView.originalBlock.increaseSiblingsPosition(newOrderPosition);

    return createTextBlock(blocksStore, {
      content,
      orderPosition: newOrderPosition,
      parentRef: blockRef(blockView.parent.$modelId),
    });
  },
);

export const injectNewRightBlock = standaloneAction(
  'harika/BlocksExtension/BlocksStore/injectNewRightBlock',
  (blocksStore: BlocksStore, blockView: BlockView, content: string) => {
    const { injectTo, parentBlock } = (() => {
      if (!blockView.parent || blockView.children.length > 0) {
        return {
          injectTo:
            Math.min(
              ...blockView.children.map(
                ({ originalBlock }) => originalBlock.orderPosition,
              ),
              0,
            ) - 1,
          parentBlock: blockView.originalBlock,
        };
      } else {
        return {
          injectTo: blockView.originalBlock.orderPosition + 1,
          parentBlock: blockView.parent.originalBlock,
        };
      }
    })();

    blockView.originalBlock.increaseSiblingsPosition(injectTo);

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
    blockView: BlockView<TextBlock>,
    caretPosStart: number,
  ) => {
    const { originalBlock } = blockView;
    const content = originalBlock.contentModel.currentValue;

    let newContent = '';
    let startAt = 0;
    let newBlock: TextBlock | undefined = undefined;
    let focusOn: TextBlock | undefined = undefined;

    if (caretPosStart === 0 && content.length !== 0 && blockView.parent) {
      newBlock = injectNewLeftBlock(blocksStore, blockView, newContent);
      focusOn = newBlock;
    } else if (
      caretPosStart > 0 &&
      caretPosStart !== content.length &&
      blockView.children.length > 0 &&
      blockView.parent
    ) {
      newBlock = injectNewLeftBlock(
        blocksStore,
        blockView,
        content.slice(0, caretPosStart),
      );
      originalBlock.setContent(content.slice(caretPosStart, content.length));

      focusOn = blockView.originalBlock;
    } else {
      if (caretPosStart !== content.length) {
        newContent = content.slice(caretPosStart, content.length);

        originalBlock.setContent(content.slice(0, caretPosStart));
      }

      const firstChild: BaseBlock | undefined =
        blockView.children[0]?.originalBlock;

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

      newBlock = injectNewRightBlock(blocksStore, blockView, newContent);
      focusOn = newBlock;
    }

    return { focusStartAt: startAt, focusOn, newBlock };
  },
);

export const toggleTodo = standaloneAction(
  'harika/BlocksExtension/TextBlock/toggleTodo',
  (
    textBlock: TextBlock,
    blockView: BlockView,
    id: string,
    toggledModels: BlockView[] = [],
  ): BlockView[] => {
    const token = textBlock.contentModel.getTokenById(id);

    if (!token || !isTodo(token)) return [];

    if (textBlock.contentModel.firstTodoToken?.id === id) {
      blockView.children.forEach((block) => {
        if (!(block.originalBlock instanceof TextBlock)) return;

        const firstTodo = textBlock.contentModel.firstTodoToken;

        if (firstTodo && firstTodo.ref === token.ref)
          toggleTodo(block.originalBlock, block, firstTodo.id, toggledModels);
      });
    }

    textBlock.contentModel.toggleTodo(id);

    toggledModels.push(blockView);

    return toggledModels;
  },
);
