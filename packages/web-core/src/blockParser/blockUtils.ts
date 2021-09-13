import { generateId } from '../generateId';
import { NoteBlockModel, Vault } from '../VaultContext/NotesService';
import { BlockContentModel } from '../VaultContext/domain/NoteBlocksApp/models/BlockContentModel';
import { parseStringToTree } from './parseStringToTree';
import type { TreeToken } from './parseStringToTree';
import type { BlocksRegistry } from '../VaultContext/domain/NoteBlocksApp/models/BlocksRegistry';
import type { BlocksViewRegistry } from '../VaultContext/domain/NoteBlocksApp/views/BlocksViewRegistry';
import type { BlockView } from '../VaultContext/domain/NoteBlocksApp/views/BlockView';

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
  registry: BlocksViewRegistry,
  view: BlockView,
  tokens: TreeToken[],
): BlockView[] => {
  const addedModels: BlockView[] = [];

  tokens = tokens.map((token) => ({ ...token, indent: token.indent + 1 }));

  let previousBlock: { model: BlockView; indent: number } | undefined =
    undefined;
  let currentPath: { model: BlockView; indent: number }[] = [
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

  const vault = new Vault({
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
