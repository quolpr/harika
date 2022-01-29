import { generateId } from '../generateId';
import { parseStringToTree } from './parseStringToTree';
import type { TreeToken } from './parseStringToTree';
import { Optional } from 'utility-types';
import { ModelCreationData, standaloneAction } from 'mobx-keystone';
import {
  CollapsableBlock,
  getCollapsableBlock,
} from '../../apps/VaultApplication/BlocksExtension/models/CollapsableBlock';
import { TextBlock } from '../../apps/VaultApplication/BlocksExtension/models/TextBlock';
import { blockRef } from '../../apps/VaultApplication/BlocksExtension/models/BaseBlock';
import { BlocksScope } from '../../apps/VaultApplication/BlocksExtension/models/BlocksScope';
import { BlocksStore } from '../../apps/VaultApplication/BlocksExtension/models/BlocksStore';

export const normalizeBlockTree = (str: string) => {
  const parsed = parseStringToTree(str);

  let normalized = '';

  parsed.forEach(({ indent, content, id }) => {
    normalized += `${'  '.repeat(indent)}- ${content}${
      id ? ` [#${id}]` : ''
    }\n`;
  });

  return normalized.trim();
};

export const addTokensToNoteBlock = standaloneAction(
  'harika/BlocksExtension/BlocksStore/addTokensToNoteBlock',
  (
    store: BlocksStore,
    scope: BlocksScope,
    block: CollapsableBlock,
    tokens: TreeToken[],
  ): CollapsableBlock[] => {
    const addedModels: CollapsableBlock[] = [];

    tokens = tokens.map((token) => ({ ...token, indent: token.indent + 1 }));

    let previousBlock: { model: CollapsableBlock; indent: number } | undefined =
      undefined;
    let currentPath: { model: CollapsableBlock; indent: number }[] = [
      { model: block, indent: 0 },
    ];

    tokens.forEach((token) => {
      if (previousBlock) {
        if (token.indent > previousBlock.indent) {
          currentPath.push(previousBlock);
        } else if (token.indent < previousBlock.indent) {
          currentPath = currentPath.filter(
            (block) => block.indent < token.indent,
          );
        }
      }

      const parentBlock = currentPath[currentPath.length - 1];
      const newBlock = new TextBlock({
        $modelId: token.id ? token.id : generateId(),
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        content: token.content,
        parentRef: blockRef(parentBlock.model.originalBlock),
        orderPosition: parentBlock.model.childrenBlocks.length,
      });
      store.registerBlock(newBlock);
      const collapsableBlock = getCollapsableBlock(scope, newBlock);

      previousBlock = { model: collapsableBlock, indent: currentPath.length };
      addedModels.push(collapsableBlock);
    });

    return addedModels;
  },
);

// export const parseToBlocksTree = (str: string) => {
//   // const tokens = parseStringToTree(str);

//   const vault = new Vault({
//     name: 'Vault',
//   });

//   const { note, treeRegistry } = vault.newNote(
//     { title: 'NotesApp' },
//     { addEmptyBlock: false },
//   );

//   if (!treeRegistry.rootBlock) {
//     throw new Error('Root block is not present!');
//   }

//   // addTokensToNoteBlock(treeRegistry, treeRegistry.rootBlock, tokens);

//   return { vault, note };
// };
