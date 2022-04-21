import { standaloneAction } from 'mobx-keystone';

import { blockRef } from '../../apps/VaultApplication/BlocksExtension/models/BaseBlock';
import { BlocksScope } from '../../apps/VaultApplication/BlockScopesExtension/models/BlocksScope';
import { BlocksStore } from '../../apps/VaultApplication/BlocksExtension/models/BlocksStore';
import {
  BlockView,
  getBlockView,
} from '../../apps/VaultApplication/BlocksExtension/models/BlockView';
import { TextBlock } from '../../apps/VaultApplication/BlocksExtension/models/TextBlock';
import { generateId } from '../generateId';
import type { TreeToken } from './parseStringToTree';
import { parseStringToTree } from './parseStringToTree';

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
    block: BlockView,
    tokens: TreeToken[],
  ): BlockView[] => {
    const addedModels: BlockView[] = [];

    tokens = tokens.map((token) => ({ ...token, indent: token.indent + 1 }));

    let previousBlock: { model: BlockView; indent: number } | undefined =
      undefined;
    let currentPath: { model: BlockView; indent: number }[] = [
      { model: block, indent: 0 },
    ];

    tokens.forEach((token, i) => {
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
        id: token.id ? token.id : generateId(),
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        content: token.content,
        parentRef: blockRef(parentBlock.model.originalBlock),
        orderPosition: i,
      });

      store.registerBlock(newBlock);
      const collapsableBlock = getBlockView(scope, newBlock);

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
