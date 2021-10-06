import { generateId } from '../generateId';
import { Vault } from '../../apps/VaultApp/VaultApp';
import { BlockContentModel } from '../../newApps/VaultApplication/NoteBlocksExtension/models/BlockContentModel';
import { parseStringToTree } from './parseStringToTree';
import type { TreeToken } from './parseStringToTree';
import type { ScopedBlock } from '../../apps/VaultApp/NoteBlocksApp/views/ScopedBlock';
import { BlocksScope } from '../../apps/VaultApp/NoteBlocksApp/views/BlocksScope';

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

export const addTokensToNoteBlock = (
  scope: BlocksScope,
  block: ScopedBlock,
  tokens: TreeToken[],
): ScopedBlock[] => {
  const addedModels: ScopedBlock[] = [];

  tokens = tokens.map((token) => ({ ...token, indent: token.indent + 1 }));

  let previousBlock: { model: ScopedBlock; indent: number } | undefined =
    undefined;
  let currentPath: { model: ScopedBlock; indent: number }[] = [
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

    const newBlock = scope.createBlock(
      {
        $modelId: token.id ? token.id : generateId(),
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        noteId: block.noteId,
        noteBlockRefs: [],
        linkedNoteIds: [],
        content: new BlockContentModel({ _value: token.content }),
      },
      parentBlock.model,
      'append',
    );

    previousBlock = { model: newBlock, indent: currentPath.length };

    addedModels.push(newBlock);
  });

  return addedModels;
};

export const parseToBlocksTree = (str: string) => {
  // const tokens = parseStringToTree(str);

  const vault = new Vault({
    name: 'Vault',
  });

  const { note, treeRegistry } = vault.newNote(
    { title: 'NotesApp' },
    { addEmptyBlock: false },
  );

  if (!treeRegistry.rootBlock) {
    throw new Error('Root block is not present!');
  }

  // addTokensToNoteBlock(treeRegistry, treeRegistry.rootBlock, tokens);

  return { vault, note };
};
