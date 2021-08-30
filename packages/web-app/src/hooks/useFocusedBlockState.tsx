import { FocusedBlockState } from '@harika/web-core';
import type { EditState } from '@harika/web-core';
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
  const vault = useCurrentVault();

  const focusState = computed(
    () => vault.ui.focusedBlock.getFocusState(viewId, blockId),
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
        vault.ui.focusedBlock.setState(
          FocusedBlockState.create(
            block.viewId,
            block.blockId,
            block.isEditing,
            block.startAt,
          ),
        );
      } else {
        vault.ui.focusedBlock.setState(undefined);
      }
    },
    [vault.ui.focusedBlock],
  );

  return [focusState, setState];
};
