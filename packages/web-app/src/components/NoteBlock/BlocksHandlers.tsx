import { BlocksScope, BlockView, getBlocksSelection } from '@harika/web-core';
import { isEqual } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { OperatorFunction } from 'rxjs';
import { EMPTY, fromEvent, merge } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  finalize,
  map,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';

import { useBlockFocusState } from '../../hooks/useBlockFocusState';
import { useBlocksStore } from '../../hooks/vaultAppHooks';

export const BlocksHandlers = observer(
  ({ scope, rootBlock }: { scope: BlocksScope; rootBlock: BlockView }) => {
    const blockFocusState = useBlockFocusState();
    const blocksStore = useBlocksStore();
    const blockSelection = getBlocksSelection(scope, rootBlock);

    useEffect(() => {
      const mouseMove$ = fromEvent<MouseEvent>(document, 'mousemove');
      const mouseUp$ = fromEvent<MouseEvent>(document, 'mouseup');
      const mouseDown$ = fromEvent<MouseEvent>(document, 'mousedown');

      const mouseMoveHandler = mouseDown$
        .pipe(
          map((e) => {
            const el = (e.target as HTMLElement).closest<HTMLDivElement>(
              `[data-type="text-block"][data-scope-id="${scope.$modelId}"]`,
            );

            return {
              fromBlockId: el?.dataset?.id,
              shiftKey: e.shiftKey,
              mouseDownEvent: e,
            };
          }),
          switchMap(({ fromBlockId, shiftKey, mouseDownEvent }) => {
            if (!fromBlockId) {
              if (blockSelection.selectionInterval !== undefined) {
                blockSelection.resetSelection();
              }

              return EMPTY;
            }

            const idOnMouseMove$ = mouseMove$.pipe(
              map((e) => {
                const el2 = (e.target as HTMLElement).closest<HTMLDivElement>(
                  `[data-type="text-block"][data-scope-id="${scope.$modelId}"]`,
                );

                // To prevent case when user just made click and mouse dragged a little bit
                if (
                  Math.abs(e.clientX - mouseDownEvent.clientX) < 20 &&
                  Math.abs(e.clientY - mouseDownEvent.clientY) < 20
                )
                  return;

                return el2?.dataset?.id;
              }),
              filter((id) => Boolean(id)) as OperatorFunction<
                string | undefined,
                string
              >,
              distinctUntilChanged(),
            );

            const currentFocus = blockFocusState.currentFocus;

            const resetAnySelection$ = mouseMove$.pipe(
              tap(() => {
                if (blockSelection.selectionInterval !== undefined) {
                  window.getSelection()?.removeAllRanges();
                }
              }),
              takeUntil(mouseUp$),
            );

            // shift+click handling
            if (
              currentFocus &&
              currentFocus.scopeId === scope.$modelId &&
              blockFocusState.isEditing === true &&
              blockSelection.selectionInterval === undefined &&
              shiftKey
            ) {
              blockSelection.setSelectionInterval(
                currentFocus.blockId,
                fromBlockId,
              );
              blockFocusState.resetFocus();

              return EMPTY;
            }

            if (blockSelection.selectionInterval !== undefined && shiftKey) {
              blockSelection.expandSelection(fromBlockId);

              return merge(
                idOnMouseMove$.pipe(
                  tap((toId) => {
                    blockSelection.expandSelection(toId);
                  }),
                  takeUntil(mouseUp$),
                ),
                resetAnySelection$,
              );
            } else {
              let wasAnyIdSelected = false;

              return merge(
                idOnMouseMove$.pipe(
                  filter(
                    (toId) => !(fromBlockId === toId && !wasAnyIdSelected),
                  ),
                  tap((toId) => {
                    if (
                      blockSelection.selectionInterval &&
                      isEqual(
                        [...blockSelection.selectionInterval].sort(),
                        [fromBlockId, toId].sort(),
                      )
                    ) {
                      return;
                    }

                    blockSelection.setSelectionInterval(fromBlockId, toId);
                    blockFocusState.resetFocus();

                    wasAnyIdSelected = true;
                  }),
                  finalize(() => {
                    if (!wasAnyIdSelected) {
                      blockSelection.resetSelection();
                    }
                  }),
                  takeUntil(mouseUp$),
                ),
                resetAnySelection$,
              );
            }
          }),
        )
        .subscribe();

      return () => {
        mouseMoveHandler.unsubscribe();
      };
    }, [blockSelection, blockFocusState, scope.$modelId]);

    const isSelecting = blockSelection.selectionInterval !== undefined;

    useEffect(() => {
      if (!isSelecting) return;

      const handler = () => {
        navigator.clipboard.writeText(blockSelection.stringTreeToCopy);
      };

      document.addEventListener('copy', handler);

      return () => document.removeEventListener('copy', handler);
    }, [blockSelection, isSelecting]);

    useEffect(() => {
      if (!isSelecting) return;
      const handler = () => {
        const selectedIds = blockSelection.selectedBlockIds;

        navigator.clipboard.writeText(blockSelection.stringTreeToCopy);

        blocksStore.deletedBlockByIds(selectedIds);
      };

      document.addEventListener('cut', handler);

      return () => document.removeEventListener('cut', handler);
    }, [blockSelection, blocksStore, isSelecting]);

    useEffect(() => {
      if (!isSelecting) return;

      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          blocksStore.deletedBlockByIds(blockSelection.selectedBlockIds);
        }
      };

      document.addEventListener('keydown', handler);

      return () => document.removeEventListener('keydown', handler);
    }, [blockSelection, blocksStore, isSelecting]);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          blockFocusState.currentFocus &&
          blockFocusState.currentFocus.scopeId === scope.$modelId &&
          blockFocusState.isEditing &&
          !(
            e.target instanceof Element &&
            (e.target.closest('.toolbar') ||
              e.target.closest('.notification') ||
              e.target.closest('.note-autocomplete')) &&
            !e.target.closest('[data-defocus]')
          ) &&
          e.target instanceof Element &&
          (e.target.closest('[data-type="text-block"]') as HTMLElement)?.dataset
            ?.id !== blockFocusState.currentFocus.blockId
        ) {
          blockFocusState.setIsEditing(false);
        }
      };

      document.addEventListener('mousedown', handler);

      return () => document.removeEventListener('mousedown', handler);
    }, [blockFocusState, scope.$modelId]);

    return null;
  },
);
