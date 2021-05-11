import { FocusedBlockState } from '@harika/harika-front-core';
import { comparer, computed } from 'mobx';
import { useCallback } from 'react';
import { useCurrentVaultUiState } from '../contexts/CurrentVaultUiStateContext';

export const useCurrentFocusedBlockState = (
  viewId: string,
  blockId: string
): [
  { isFocused: boolean; isEditing: boolean; startAt?: number },
  (
    block:
      | {
          viewId: string;
          blockId: string;
          startAt?: number;
          isEditing?: boolean;
        }
      | undefined
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
            isEditing?: boolean;
            startAt?: number;
          }
        | undefined
    ) => {
      if (block) {
        vaultUiState.setFocusedBlock(
          FocusedBlockState.create(
            block.viewId,
            block.blockId,
            block.isEditing,
            block.startAt
          )
        );
      } else {
        vaultUiState.setFocusedBlock(undefined);
      }
    },
    [vaultUiState]
  );

  return [focusState, setState];
};
