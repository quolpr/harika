import { FocusedBlockState } from '@harika/harika-core';
import { comparer, computed } from 'mobx';
import { useCallback } from 'react';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';

export const useCurrentFocusedBlockState = (
  viewId: string,
  blockId: string
): [
  { isFocused: boolean; startAt?: number },
  (
    block: { viewId: string; blockId: string; startAt?: number } | undefined
  ) => void
] => {
  const vaultUiState = useCurrentVaultUiState();

  const focusState = computed(
    () => vaultUiState.getBlockFocusState(viewId, blockId),
    { equals: comparer.shallow }
  ).get();

  const setState = useCallback(
    (
      block:
        | {
            viewId: string;
            blockId: string;
            startAt?: number;
          }
        | undefined
    ) => {
      if (block) {
        vaultUiState.setFocusedBlock(
          new FocusedBlockState({
            id: `${block.viewId}-${block.blockId}`,
            startAt: block.startAt,
          })
        );
      } else {
        vaultUiState.setFocusedBlock(undefined);
      }
    },
    [vaultUiState]
  );

  return [focusState, setState];
};
