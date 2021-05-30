import { VaultModel } from './VaultModel';

const parseToBlocksTree = (str: string) => {
  const regex = /^(\s*)\-(.*?)\[#(.*?)\]$/gm;

  let baseIndent = 0;

  const vault = new VaultModel({
    name: 'Vault',
  });
  const note = vault.newNote({ title: 'Note' });

  const tokens = [...str.matchAll(regex)].map((group, i) => {
    let [, spaces, name, id] = group;

    spaces = spaces.replace(/[\n\r]+/g, '');
    name = name.trim();
    id = id.trim();

    if (i === 0) {
      baseIndent = spaces.length;
    }

    const indent = spaces.length - baseIndent;

    return { indent, name, id };
  });
  console.log(tokens);
};

describe('BlocksViewModel', () => {
  describe('getSelectedIds', () => {
    it('returns correct selection', () => {
      const tree = parseToBlocksTree(`
        - block1 [#1]
          - block2 [#2]
        - block3 [#3]
      `);
      console.log(tree);
    });
  });
});
