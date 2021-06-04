import { EditState, FocusedBlockState } from '@harika/web-core';
import { comparer, computed } from 'mobx';
import { useCallback } from 'react';
import { useCurrentVault } from './useCurrentVault';

export const useCurrentFocusedBlockState = (
  viewId: string,
  blockId: string,
): [
  EditState,
  (
    block:
      | {
          viewId: string;
          blockId: string;
          startAt?: number;
          isEditing?: boolean;
        }
      | undefined,
  ) => void,
] => {
  const vaultUiState = useCurrentVault().ui;

  const focusState = computed(
    () => vaultUiState.getBlockFocusState(viewId, blockId),
    { equals: comparer.shallow },
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
        | undefined,
    ) => {
      if (block) {
        vaultUiState.setFocusedBlock(
          FocusedBlockState.create(
            block.viewId,
            block.blockId,
            block.isEditing,
            block.startAt,
          ),
        );
      } else {
        vaultUiState.setFocusedBlock(undefined);
      }
    },
    [vaultUiState],
  );

  return [focusState, setState];
};
