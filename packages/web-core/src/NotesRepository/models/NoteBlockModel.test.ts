import { expect } from '@esm-bundle/chai';
import { normalizeBlockTree, parseToBlocksTree } from '../../tests/blockUtils';
import { parseStringToTree } from './NoteBlockModel/parseStringToTree';

describe('NoteBlockModel', () => {
  describe('getStringTree', () => {
    it('works', () => {
      const expectedTree = normalizeBlockTree(`
        - block1 [#1]
          - block2 [#2]
        - block5 [#3]
      `);

      const { note } = parseToBlocksTree(expectedTree);

      expect(note.rootBlockRef.current.getStringTree(true).trim()).to.equal(
        expectedTree,
      );
    });

    it('works with deeply nesting', () => {
      const normalizedTree = normalizeBlockTree(`
        - block1 [#1]
          - block2 [#2]
            - block3 [#3]
            - block4 [#4]
        - block5 [#5]
      `);

      const { note } = parseToBlocksTree(normalizedTree);

      expect(note.rootBlockRef.current.getStringTree(true).trim()).to.equal(
        normalizedTree,
      );
    });
  });

  describe('injectNewTreeTokens', () => {
    it('injects new tree to existent tree', () => {
      const { vault, note } = parseToBlocksTree(`
        - block0
        - block1
        - block2
          - block3
          - block4 [#4]
        - block5
      `);

      const treeTokens = parseStringToTree(`
          - block6
          - block7
            - block8
              - block9
              - block10
        - block11
     `);

      vault.blocksMap['4'].injectNewTreeTokens(treeTokens);

      expect(note.rootBlockRef.current.getStringTree().trim()).to.equal(
        normalizeBlockTree(`
          - block0
          - block1
          - block2
            - block3
            - block4
            - block6
            - block7
              - block8
                - block9
                - block10
            - block11
          - block5
        `),
      );
    });
  });
});
