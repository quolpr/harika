import { expect } from '@esm-bundle/chai';
import { normalizeBlockTree, parseToBlocksTree } from '../../tests/blockUtils';

describe('NoteBlockModel', () => {
  describe('getStringTree', () => {
    it('works', () => {
      const normalizedTree = normalizeBlockTree(`
        - block1 [#1]
          - block2 [#2]
        - block5 [#3]
      `);

      const { note } = parseToBlocksTree(normalizedTree);

      expect(note.rootBlockRef.current.getStringTree(true)).to.equal(
        normalizedTree,
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

      expect(note.rootBlockRef.current.getStringTree(true)).to.equal(
        normalizedTree,
      );
    });
  });
});
