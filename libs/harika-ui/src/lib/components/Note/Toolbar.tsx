import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';
import { useCurrentVaultUiState } from '../../contexts/CurrentVaultUiStateContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { cn } from '../../utils';
import { BlocksViewModel, FocusedBlockState } from '@harika/harika-core';
import { Portal } from '../Portal';
import {
  ArrowDropDown,
  ArrowDropUp,
  FormatIndentDecrease,
  FormatIndentIncrease,
  KeyboardHide,
  KeyboardReturn,
} from '@material-ui/icons';

const toolbarClass = cn('toolbar');

export const Toolbar = observer(({ view }: { view: BlocksViewModel }) => {
  const vaultUiState = useCurrentVaultUiState();
  const vault = useCurrentVault();

  const currentBlock = vaultUiState.focusedBlock?.blockId
    ? vault.blocksMap[vaultUiState.focusedBlock?.blockId]
    : undefined;

  const handleNewBlockPress = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      const newBlock = currentBlock.injectNewRightBlock('', view);

      if (!newBlock) return;

      vaultUiState.setFocusedBlock(
        FocusedBlockState.create(view.$modelId, newBlock.$modelId, true)
      );
    },
    [currentBlock, vaultUiState, view]
  );

  const handleMoveUpPress = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      currentBlock.tryMoveUp();
    },
    [currentBlock]
  );

  const handleMoveDownPress = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      currentBlock.tryMoveDown();
    },
    [currentBlock]
  );

  const handleMoveLeft = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      currentBlock.tryMoveLeft();
    },
    [currentBlock]
  );

  const handleMoveRight = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      currentBlock.tryMoveRight();
    },
    [currentBlock]
  );

  return (
    <Portal>
      <div className={toolbarClass()}>
        <button
          onMouseDown={handleMoveDownPress}
          className={toolbarClass('button')}
        >
          <FormatIndentDecrease />
        </button>
        <button
          onMouseDown={handleMoveUpPress}
          className={toolbarClass('button')}
        >
          <FormatIndentIncrease />
        </button>
        <button
          onMouseDown={handleMoveRight}
          className={toolbarClass('button')}
        >
          <ArrowDropDown />
        </button>
        <button onMouseDown={handleMoveLeft} className={toolbarClass('button')}>
          <ArrowDropUp />
        </button>
        <button className={toolbarClass('button')} data-defocus>
          <KeyboardHide />
        </button>
        <button
          onClick={handleNewBlockPress}
          className={toolbarClass('button')}
        >
          <KeyboardReturn />
        </button>
      </div>
    </Portal>
  );
});
