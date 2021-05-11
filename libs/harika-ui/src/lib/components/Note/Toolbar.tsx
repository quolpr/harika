import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useState } from 'react';
import { useCurrentVaultUiState } from '../../contexts/CurrentVaultUiStateContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { cn } from '../../utils';
import { BlocksViewModel, FocusedBlockState } from '@harika/harika-front-core';
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

  const [bottomPos, setBottomPos] = useState(0);

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

  useEffect(() => {
    if (!window.visualViewport) return;

    const viewportHandler = () => {
      console.log(window.innerHeight - window.visualViewport.height);
      setBottomPos(window.innerHeight - window.visualViewport.height);
    };

    window.visualViewport.addEventListener('scroll', viewportHandler);
    window.visualViewport.addEventListener('resize', viewportHandler);

    return () => {
      window.visualViewport.removeEventListener('scroll', viewportHandler);
      window.visualViewport.removeEventListener('resize', viewportHandler);
    };
  });

  return (
    <Portal>
      <div
        className={toolbarClass()}
        style={{ transform: `translate3d(0px, ${-bottomPos}px, 0px)` }}
      >
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
