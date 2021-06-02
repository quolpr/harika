import { expect } from '@esm-bundle/chai';
import { parseToBlocksTree } from '../../tests/blockUtils';
import { BlocksViewModel } from './BlocksViewModel';
import { noteRef } from './NoteModel';

describe('BlocksViewModel', () => {
  describe('selectInterval', () => {
    it('works', () => {
      const { note, vault } = parseToBlocksTree(`
        - block1 [#1]
          - block2 [#2]
            - block3 [#3]
            - block4 [#4]
          - block5 [#5]
        - block6 [#6]
          - block7 [#7]
          - block8 [#8]
      `);

      const viewModel = vault.getOrCreateViewByModel(note, {
        $modelId: '123',
        $modelType: '345',
      });

      viewModel.selectInterval('2', '8');

      expect(viewModel.selectedIds).to.deep.eq([
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
      ]);
    });
  });
});
