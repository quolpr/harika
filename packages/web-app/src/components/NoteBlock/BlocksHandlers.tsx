import { BlocksScope, CollapsableBlock, NoteBlock } from '@harika/web-core';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import type { OperatorFunction } from 'rxjs';
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
import { isEqual } from 'lodash-es';
import {
  FocusedBlockState,
  useFocusedBlock,
} from '../../hooks/useFocusedBlockState';
import { useBlocksStore } from '../../hooks/vaultAppHooks';

export const BlocksHandlers = observer(
  ({
    scope,
    rootBlock,
  }: {
    scope: BlocksScope;
    rootBlock: CollapsableBlock;
  }) => {
    const focusedBlock = useFocusedBlock();
    const blocksStore = useBlocksStore();

    useEffect(() => {
      const mouseMove$ = fromEvent<MouseEvent>(document, 'mousemove');
      const mouseUp$ = fromEvent<MouseEvent>(document, 'mouseup');
      const mouseDown$ = fromEvent<MouseEvent>(document, 'mousedown');

      const idOnMouseMove$ = mouseMove$.pipe(
        map((e) => {
          const el2 = (e.target as HTMLElement).closest<HTMLDivElement>(
            `[data-type="note-block"][data-scope-id="${scope.$modelId}"]`,
          );

          return el2?.dataset?.id;
        }),
        filter((id) => Boolean(id)) as OperatorFunction<
          string | undefined,
          string
        >,
        distinctUntilChanged(),
      );

      const mouseMoveHandler = mouseDown$
        .pipe(
          map((e) => {
            const el = (e.target as HTMLElement).closest<HTMLDivElement>(
              `[data-type="note-block"][data-scope-id="${scope.$modelId}"]`,
            );

            return { fromBlockId: el?.dataset?.id, shiftKey: e.shiftKey };
          }),
          switchMap(({ fromBlockId, shiftKey }) => {
            if (!fromBlockId) {
              if (scope.selectionInterval !== undefined) {
                scope.resetSelection();
              }

              return EMPTY;
            }

            const focusedBlockState = focusedBlock.state;

            const resetAnySelection$ = mouseMove$.pipe(
              tap(() => {
                if (scope.selectionInterval !== undefined) {
                  window.getSelection()?.removeAllRanges();
                }
              }),
              takeUntil(mouseUp$),
            );

            // shift+click handling
            if (
              focusedBlockState &&
              focusedBlockState.scopeId === scope.$modelId &&
              focusedBlockState.isEditing === true &&
              scope.selectionInterval === undefined &&
              shiftKey
            ) {
              scope.setSelectionInterval(
                focusedBlockState.scopedBlockId,
                fromBlockId,
              );
              focusedBlock.setState(undefined);

              return EMPTY;
            }

            if (scope.selectionInterval !== undefined && shiftKey) {
              scope.expandSelection(fromBlockId);

              return merge(
                idOnMouseMove$.pipe(
                  tap((toId) => {
                    scope.expandSelection(toId);
                  }),
                  takeUntil(mouseUp$),
                ),
                resetAnySelection$,
              );
            } else {
              let wasAnyIdSelected = false;

              return merge(
                idOnMouseMove$.pipe(
                  // If just click happened, so selection will happen only if mouse will be moved to the different block
                  filter(
                    (toId) => !(fromBlockId === toId && !wasAnyIdSelected),
                  ),
                  tap((toId) => {
                    if (
                      scope.selectionInterval &&
                      isEqual(
                        [...scope.selectionInterval].sort(),
                        [fromBlockId, toId].sort(),
                      )
                    ) {
                      return;
                    }

                    scope.setSelectionInterval(fromBlockId, toId);
                    focusedBlock.setState(undefined);

                    wasAnyIdSelected = true;
                  }),
                  finalize(() => {
                    if (!wasAnyIdSelected) {
                      scope.resetSelection();
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
    }, [focusedBlock, scope]);

    const isSelecting = scope.selectionInterval !== undefined;

    useEffect(() => {
      if (!isSelecting) return;

      const handler = () => {
        navigator.clipboard.writeText(scope.getStringTreeToCopy(rootBlock));
      };

      document.addEventListener('copy', handler);

      return () => document.removeEventListener('copy', handler);
    }, [isSelecting, rootBlock, scope]);

    useEffect(() => {
      if (!isSelecting) return;
      const handler = () => {
        const selectedIds = scope.getSelectedBlockIds(rootBlock);

        navigator.clipboard.writeText(scope.getStringTreeToCopy(rootBlock));

        blocksStore.deletedBlockByIds(selectedIds);
      };

      document.addEventListener('cut', handler);

      return () => document.removeEventListener('cut', handler);
    }, [blocksStore, isSelecting, rootBlock, scope]);

    useEffect(() => {
      if (!isSelecting) return;

      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          blocksStore.deletedBlockByIds(scope.getSelectedBlockIds(rootBlock));
        }
      };

      document.addEventListener('keydown', handler);

      return () => document.removeEventListener('keydown', handler);
    }, [blocksStore, isSelecting, rootBlock, scope]);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          focusedBlock.state &&
          focusedBlock.state.scopeId === scope.$modelId &&
          focusedBlock.state?.isEditing &&
          !(
            e.target instanceof Element &&
            (e.target.closest('.toolbar') ||
              e.target.closest('.note-autocomplete')) &&
            !e.target.closest('[data-defocus]')
          ) &&
          e.target instanceof Element &&
          (e.target.closest('[data-type="note-block"]') as HTMLElement)?.dataset
            ?.id !== focusedBlock.state.scopedBlockId
        ) {
          focusedBlock.setState(
            new FocusedBlockState({
              ...focusedBlock.state.$,
              isEditing: false,
            }),
          );
        }
      };

      document.addEventListener('mousedown', handler);

      return () => document.removeEventListener('mousedown', handler);
    }, [focusedBlock, scope.$modelId]);

    return null;
  },
);
