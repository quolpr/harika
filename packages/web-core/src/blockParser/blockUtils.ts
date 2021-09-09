import { generateId } from '../generateId';
import { NoteBlockModel, VaultModel } from '../VaultContext/NotesService';
import { BlockContentModel } from '../VaultContext/domain/NoteBlocksApp/NoteBlockModel/BlockContentModel';
import { parseStringToTree } from './parseStringToTree';
import type { TreeToken } from './parseStringToTree';
import type { BlocksRegistry } from '../VaultContext/domain/NoteBlocksApp/BlocksRegistry';
import type { ViewRegistry } from '../VaultContext/domain/NoteBlocksApp/BlocksScope/ViewRegistry';
import type { BlocksViewModel } from '../VaultContext/domain/NoteBlocksApp/BlocksScope/BlocksViewModel';

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
  registry: ViewRegistry,
  view: BlocksViewModel,
  tokens: TreeToken[],
): BlocksViewModel[] => {
  const addedModels: BlocksViewModel[] = [];

  tokens = tokens.map((token) => ({ ...token, indent: token.indent + 1 }));

  let previousBlock: { model: BlocksViewModel; indent: number } | undefined =
    undefined;
  let currentPath: { model: BlocksViewModel; indent: number }[] = [
    { model: view, indent: 0 },
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

    const parentView = currentPath[currentPath.length - 1];

    const newBlock = registry.createBlock(
      {
        $modelId: token.id ? token.id : generateId(),
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
        noteId: view.noteId,
        noteBlockRefs: [],
        linkedNoteIds: [],
        content: new BlockContentModel({ value: token.content }),
      },
      parentView.model,
      'append',
    );

    previousBlock = { model: newBlock, indent: currentPath.length };

    addedModels.push(newBlock);
  });

  return addedModels;
};

export const parseToBlocksTree = (str: string) => {
  const tokens = parseStringToTree(str);

  const vault = new VaultModel({
    name: 'Vault',
  });

  const { note, treeRegistry: treeHolder } = vault.newNote(
    { title: 'Note' },
    { addEmptyBlock: false },
  );

  if (!treeHolder.rootBlock) {
    throw new Error('Root block is not present!');
  }

  // addTokensToNoteBlock(treeHolder, treeHolder.rootBlock, tokens);

  return { vault, note };
};
