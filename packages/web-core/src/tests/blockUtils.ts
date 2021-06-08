import { generateId } from '@harika/common';
import { NoteBlockModel, VaultModel } from '../NotesRepository';
import { noteBlockRef } from '../NotesRepository/models/NoteBlockModel';
import { BlockContentModel } from '../NotesRepository/models/NoteBlockModel/BlockContentModel';
import {
  parseStringToTree,
  TreeToken,
} from '../NotesRepository/models/NoteBlockModel/parseStringToTree';
import { NoteModel, noteRef } from '../NotesRepository/models/NoteModel';

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
  note: NoteModel,
  noteBlock: NoteBlockModel,
  tokens: TreeToken[],
): NoteBlockModel[] => {
  const addedModels: NoteBlockModel[] = [];

  const virtualRootBlock = new NoteBlockModel({
    createdAt: new Date().getTime(),
    noteRef: noteRef(note),
    noteBlockRefs: [],
    parentBlockRef: undefined,
    linkedNoteRefs: [],
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
      noteRef: noteRef(note),
      noteBlockRefs: [],
      parentBlockRef: noteBlockRef(parentBlock.model),
      linkedNoteRefs: [],
      content: new BlockContentModel({ value: token.content }),
    });

    parentBlock.model.appendChildBlock(newBlock);

    previousBlock = { model: newBlock, indent: currentPath.length };

    addedModels.push(previousBlock.model);
  });

  note.vault.addBlocks(addedModels);

  noteBlock.merge(virtualRootBlock);

  return addedModels;
};

export const parseToBlocksTree = (str: string) => {
  const tokens = parseStringToTree(str);

  const vault = new VaultModel({
    name: 'Vault',
  });

  const note = vault.newNote({ title: 'Note' }, { addEmptyBlock: false });

  addTokensToNoteBlock(note, note.rootBlockRef.current, tokens);

  return { vault, note };
};
