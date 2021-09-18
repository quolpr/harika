import { FocusedBlockState } from '@harika/web-core';
import type { EditState } from '@harika/web-core';
import { comparer, computed } from 'mobx';
import { useCallback } from 'react';
import { useBlocksApp } from './useCurrentVault';
import { isEqual } from 'lodash-es';

export const useCurrentFocusedBlockState = (
  scopeId: string,
  scopedBlockId: string,
): [
  EditState,
  (
    block:
      | {
          scopeId: string;
          scopedBlockId: string;
          startAt?: number;
          isEditing?: boolean;
        }
      | undefined,
  ) => void,
] => {
  const blocksApp = useBlocksApp();

  const focusState = computed(
    () => blocksApp.focusedBlock.getFocusState(scopeId, scopedBlockId),
    { equals: comparer.shallow },
  ).get();

  const setState = useCallback(
    (
      block:
        | {
            scopeId: string;
            scopedBlockId: string;
            isEditing?: boolean;
            startAt?: number;
          }
        | undefined,
    ) => {
      if (block) {
        if (isEqual(blocksApp.focusedBlock.state, block)) return;

        blocksApp.focusedBlock.setState(
          FocusedBlockState.create(
            block.scopeId,
            block.scopedBlockId,
            block.isEditing,
            block.startAt,
          ),
        );
      } else {
        blocksApp.focusedBlock.setState(undefined);
      }
    },
    [blocksApp.focusedBlock],
  );

  return [focusState, setState];
};
