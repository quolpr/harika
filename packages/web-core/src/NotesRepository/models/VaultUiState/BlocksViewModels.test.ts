import { expect } from '@esm-bundle/chai';
import {
  normalizeBlockTree,
  parseToBlocksTree,
} from '../../../tests/blockUtils';

const getViewModel = () => {
  const { note, vault } = parseToBlocksTree(`
        - block1 [#1]
          - block2 [#2]
            - block3 [#3]
            - block4 [#4]
          - block5 [#5]
        - block6 [#6]
          - block7 [#7]
            - block8 [#8]
          - block9 [#9]
        - block10 [#10]
  `);

  const viewModel = vault.ui.createViewByModel(note, {
    $modelId: '123',
    $modelType: '345',
  });

  return { viewModel, note, vault };
};
describe('BlocksViewModel', () => {
  describe('selectInterval', () => {
    it('works', () => {
      const { viewModel } = getViewModel();

      viewModel.setSelectionInterval('2', '8');

      expect(viewModel.selectedIds).to.deep.eq([
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
      ]);
    });

    it('resets expand on set', () => {
      const { viewModel } = getViewModel();

      viewModel.setSelectionInterval('2', '4');
      viewModel.expandSelection('1');

      expect(viewModel.selectedIds).to.deep.eq(['1', '2', '3', '4', '5']);

      viewModel.setSelectionInterval('3', '5');

      expect(viewModel.selectedIds).to.deep.eq(['3', '4', '5']);
    });
  });
  describe('expandSelection', () => {
    it('works', () => {
      const { viewModel } = getViewModel();

      viewModel.setSelectionInterval('2', '4');

      viewModel.expandSelection('1');

      expect(viewModel.selectedIds).to.deep.eq(['1', '2', '3', '4', '5']);

      viewModel.expandSelection('7');

      expect(viewModel.selectedIds).to.deep.eq([
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
      ]);

      viewModel.expandSelection('3');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3', '4']);
    });
  });

  describe('resetSelection', () => {
    it('resets both selection & addableSelectionId', () => {
      const { viewModel } = getViewModel();

      viewModel.setSelectionInterval('2', '3');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3', '4']);

      viewModel.expandSelection('5');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3', '4', '5']);

      viewModel.resetSelection();

      expect(viewModel.selectedIds).to.deep.eq([]);

      viewModel.setSelectionInterval('2', '3');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3', '4']);
    });
  });

  describe('stringTreeToCopy', () => {
    it('works', () => {
      const { viewModel } = getViewModel();

      const normalizedTree = normalizeBlockTree(`
        - block3
        - block4
        - block5
        - block6
          - block7
            - block8
          - block9
        - block10
      `);

      viewModel.setSelectionInterval('3', '10');

      expect(viewModel.getStringTreeToCopy()).to.eq(normalizedTree);
    });

    it('works#2', () => {
      const { viewModel } = getViewModel();

      const normalizedTree = normalizeBlockTree(`
        - block2
          - block3
          - block4
        - block5
      `);

      viewModel.setSelectionInterval('2', '5');

      expect(viewModel.getStringTreeToCopy()).to.eq(normalizedTree);
    });
  });
});
