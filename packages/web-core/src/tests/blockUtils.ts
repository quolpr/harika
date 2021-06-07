import { NoteBlockModel, VaultModel } from '../NotesRepository';
import { BlockContentModel } from '../NotesRepository/models/NoteBlockModel/BlockContentModel';
import {
  parseStringToTree,
  TreeToken,
} from '../NotesRepository/models/NoteBlockModel/parseStringToTree';
import type { NoteModel } from '../NotesRepository/models/NoteModel';

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

  let { previousBlock, currentPath, insertTo, baseIndent } = (() => {
    if (noteBlock.isRoot) {
      const token = tokens.shift()!;

      const previousBlock = note.createBlock(
        {
          $modelId: token.id,
          content: new BlockContentModel({ value: token.content }),
        },
        noteBlock,
        0,
      );

      addedModels.push(previousBlock);

      return {
        previousBlock,
        currentPath: [noteBlock],
        insertTo: 1,
        baseIndent: 1,
      };
    } else {
      return {
        previousBlock: noteBlock,
        currentPath: [noteBlock.parentBlockRef!.current],
        insertTo: noteBlock.orderPosition + 1,
        baseIndent: noteBlock.indent,
      };
    }
  })();

  tokens.forEach((token) => {
    if (previousBlock) {
      if (token.indent > previousBlock.indent - baseIndent) {
        currentPath.push(previousBlock);
        insertTo = 0;
      } else if (token.indent < previousBlock.indent - baseIndent) {
        const newPath = currentPath.filter(
          (block) => block.indent - baseIndent < token.indent,
        );

        insertTo = currentPath[newPath.length].orderPosition + 1;

        currentPath = newPath;
      } else {
        insertTo++;
      }
    }

    const parentBlock = currentPath[currentPath.length - 1];

    previousBlock = note.createBlock(
      {
        $modelId: token.id,
        content: new BlockContentModel({ value: token.content }),
      },
      parentBlock,
      insertTo,
    );

    addedModels.push(previousBlock);
  });

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
