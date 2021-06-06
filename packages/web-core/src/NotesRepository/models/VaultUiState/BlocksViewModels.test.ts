import { expect } from '@esm-bundle/chai';
import { parseToBlocksTree } from '../../../tests/blockUtils';

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
      `);

  const viewModel = vault.ui.getOrCreateViewByModel(note, {
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
      ]);
    });

    it('resets expand on set', () => {
      const { viewModel } = getViewModel();

      viewModel.setSelectionInterval('2', '4');
      viewModel.expandSelection('1');

      expect(viewModel.selectedIds).to.deep.eq(['1', '2', '3', '4']);

      viewModel.setSelectionInterval('3', '5');

      expect(viewModel.selectedIds).to.deep.eq(['3', '4', '5']);
    });
  });
  describe('expandSelection', () => {
    it('works', () => {
      const { viewModel } = getViewModel();

      viewModel.setSelectionInterval('2', '5');

      viewModel.expandSelection('1');

      expect(viewModel.selectedIds).to.deep.eq(['1', '2', '3', '4', '5']);

      viewModel.expandSelection('7');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3', '4', '5', '6', '7']);

      viewModel.expandSelection('3');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3']);

      viewModel.fixSelection();

      viewModel.expandSelection('1');

      expect(viewModel.selectedIds).to.deep.eq(['1', '2', '3']);
    });
  });

  describe('resetSelection', () => {
    it('resets bots selection &addableSelectionId', () => {
      const { viewModel } = getViewModel();

      viewModel.setSelectionInterval('2', '3');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3']);

      viewModel.expandSelection('5');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3', '4', '5']);

      viewModel.resetSelection();

      expect(viewModel.selectedIds).to.deep.eq([]);

      viewModel.setSelectionInterval('2', '3');

      expect(viewModel.selectedIds).to.deep.eq(['2', '3']);
    });
  });

  describe('areChildrenAndParentSelected', () => {
    const { viewModel, vault } = getViewModel();

    viewModel.setSelectionInterval('2', '4');

    expect(viewModel.areChildrenAndParentSelected(vault.blocksMap['2'])).to.eq(
      true,
    );

    expect(viewModel.areChildrenAndParentSelected(vault.blocksMap['5'])).to.eq(
      false,
    );

    expect(viewModel.areChildrenAndParentSelected(vault.blocksMap['3'])).to.eq(
      false,
    );

    viewModel.setSelectionInterval('3', '4');

    expect(viewModel.areChildrenAndParentSelected(vault.blocksMap['2'])).to.eq(
      false,
    );
  });
});
