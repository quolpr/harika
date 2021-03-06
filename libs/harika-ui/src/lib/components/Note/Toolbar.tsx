import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';
import { useCurrentVaultUiState } from '../../contexts/CurrentVaultUiStateContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { cn } from '../../utils';
import { BlocksViewModel, FocusedBlockState } from '@harika/harika-core';
import { Portal } from '../Portal';
import { FormatIndentDecrease, FormatIndentIncrease } from '@material-ui/icons';

const toolbarClass = cn('toolbar');

export const Toolbar = observer(({ view }: { view: BlocksViewModel }) => {
  const vaultUiState = useCurrentVaultUiState();
  const vault = useCurrentVault();

  const currentBlock = vaultUiState.focusedBlock?.blockId
    ? vault.blocksMap[vaultUiState.focusedBlock?.blockId]
    : undefined;

  const handleNewBlockPress = useCallback(async () => {
    if (!currentBlock) return;

    const newBlock = currentBlock.injectNewRightBlock('', view);

    if (!newBlock) return;

    vaultUiState.setFocusedBlock(
      FocusedBlockState.create(view.$modelId, newBlock.$modelId, true)
    );
  }, [currentBlock, vaultUiState, view]);

  const handleMoveUpPress = useCallback(async () => {
    if (!currentBlock) return;

    currentBlock.tryMoveUp();
  }, [currentBlock]);

  const handleMoveDownPress = useCallback(async () => {
    if (!currentBlock) return;

    currentBlock.tryMoveDown();
  }, [currentBlock]);

  const handleMoveLeft = useCallback(async () => {
    if (!currentBlock) return;

    currentBlock.tryMoveLeft();
  }, [currentBlock]);

  const handleMoveRight = useCallback(async () => {
    if (!currentBlock) return;

    currentBlock.tryMoveRight();
  }, [currentBlock]);

  return (
    <Portal>
      <div className={toolbarClass()}>
        <button
          onClick={handleMoveDownPress}
          className={toolbarClass('button')}
        >
          <FormatIndentDecrease />
        </button>
        <button onClick={handleMoveUpPress} className={toolbarClass('button')}>
          <FormatIndentIncrease />
        </button>
        <button
          onClick={handleMoveDownPress}
          className={toolbarClass('button')}
        >
          D
        </button>
        <button onClick={handleMoveUpPress} className={toolbarClass('button')}>
          U
        </button>
        <button
          onClick={handleNewBlockPress}
          className={toolbarClass('button')}
        >
          +
        </button>
      </div>
    </Portal>
  );
});
