import { FocusedBlockState } from '@harika/web-core';
import type { EditState } from '@harika/web-core';
import { comparer, computed } from 'mobx';
import { useCallback } from 'react';
import { isEqual } from 'lodash-es';
import { useFocusedBlock } from './vaultAppHooks';

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
  const focusedBlock = useFocusedBlock();

  const focusState = computed(
    () => focusedBlock.getFocusState(scopeId, scopedBlockId),
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
        if (isEqual(focusedBlock.state, block)) return;

        focusedBlock.setState(
          FocusedBlockState.create(
            block.scopeId,
            block.scopedBlockId,
            block.isEditing,
            block.startAt,
          ),
        );
      } else {
        focusedBlock.setState(undefined);
      }
    },
    [focusedBlock],
  );

  return [focusState, setState];
};
