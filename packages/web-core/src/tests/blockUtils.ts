import { NoteBlockModel, VaultModel } from '../NotesRepository';
import { parseStringToTree } from '../NotesRepository/models/NoteBlockModel/parseStringToTree';

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

export const parseToBlocksTree = (str: string) => {
  const tokens = parseStringToTree(str).map((token) => ({
    ...token,
    indent: token.indent + 1,
  }));

  const vault = new VaultModel({
    name: 'Vault',
  });

  const note = vault.newNote({ title: 'Note' }, { addEmptyBlock: false });

  let previousBlock: undefined | NoteBlockModel = undefined;
  let currentPath: NoteBlockModel[] = [note.rootBlockRef.current];

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

    previousBlock = parentBlock.appendChildBlock({
      id: token.id,
      content: token.content,
    });
  });

  return { vault, note };
};
