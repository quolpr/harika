import { generateId } from '../generateId';
import { NoteBlockModel, VaultModel } from '../VaultContext/NotesService';
import { BlockContentModel } from '../VaultContext/domain/NoteBlockModel/BlockContentModel';
import { parseStringToTree, TreeToken } from './parseStringToTree';
import type { BlocksTreeHolder } from '../VaultContext/domain/NoteBlockModel';

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
  treeHolder: BlocksTreeHolder,
  noteBlock: NoteBlockModel,
  tokens: TreeToken[],
): NoteBlockModel[] => {
  const addedModels: NoteBlockModel[] = [];

  const virtualRootBlock = new NoteBlockModel({
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    noteId: noteBlock.noteId,
    noteBlockRefs: [],
    linkedNoteIds: [],
    content: new BlockContentModel({ value: '' }),
    isRoot: true,
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
      noteId: noteBlock.noteId,
      noteBlockRefs: [],
      linkedNoteIds: [],
      content: new BlockContentModel({ value: token.content }),
      isRoot: false,
    });

    parentBlock.model.appendChildBlock(newBlock);

    previousBlock = { model: newBlock, indent: currentPath.length };

    addedModels.push(previousBlock.model);
  });

  treeHolder.addBlocks(addedModels);

  noteBlock.merge(virtualRootBlock);

  return addedModels;
};

export const parseToBlocksTree = (str: string) => {
  const tokens = parseStringToTree(str);

  const vault = new VaultModel({
    name: 'Vault',
  });

  const { note, treeHolder } = vault.newNote(
    { title: 'Note' },
    { addEmptyBlock: false },
  );

  if (!treeHolder.rootBlock) {
    throw new Error('Root block is not present!');
  }

  addTokensToNoteBlock(treeHolder, treeHolder.rootBlock, tokens);

  return { vault, note };
};
