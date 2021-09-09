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
): NoteBlockModel[] => {
  const addedModels: NoteBlockModel[] = [];

  const virtualRootBlock = new NoteBlockModel({
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    noteId: view.noteId,
    noteBlockRefs: [],
    linkedNoteIds: [],
    content: new BlockContentModel({ value: '' }),
  });

  tokens = tokens.map((token) => ({ ...token, indent: token.indent + 1 }));

  let previousBlock: { model: NoteBlockModel; indent: number } | undefined =
    undefined;
  let currentPath: { model: NoteBlockModel; indent: number }[] = [
    { model: virtualRootBlock, indent: 0 },
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

    const newBlock = new NoteBlockModel({
      $modelId: token.id ? token.id : generateId(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      noteId: view.noteId,
      noteBlockRefs: [],
      linkedNoteIds: [],
      content: new BlockContentModel({ value: token.content }),
    });

    // parentBlock.model.appendChildBlock(newBlock);

    previousBlock = { model: newBlock, indent: currentPath.length };

    addedModels.push(previousBlock.model);
  });

  // registry.addBlocks(addedModels);

  // view.merge(virtualRootBlock);

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
