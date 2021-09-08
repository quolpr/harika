import { NoteModel, FocusedBlockState, BlocksScope } from '@harika/web-core';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { EMPTY, fromEvent, merge } from 'rxjs';
import type { OperatorFunction } from 'rxjs';
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
import { useCurrentVault } from '../../hooks/useCurrentVault';

export const NoteBlocksHandlers = observer(
  ({ scope, note }: { scope: BlocksScope; note: NoteModel }) => {
    const vault = useCurrentVault();
    const focusedBlock = vault.noteBlocksApp.focusedBlock;

    const registry = scope.viewRegistry;

    useEffect(() => {
      const mouseMove$ = fromEvent<MouseEvent>(document, 'mousemove');
      const mouseUp$ = fromEvent<MouseEvent>(document, 'mouseup');
      const mouseDown$ = fromEvent<MouseEvent>(document, 'mousedown');

      const idOnMouseMove$ = mouseMove$.pipe(
        map((e) => {
          const el2 = (e.target as HTMLElement).closest<HTMLDivElement>(
            `[data-type="note-block"][data-view-id="${scope.$modelId}"]`,
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
              `[data-type="note-block"][data-view-id="${scope.$modelId}"]`,
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

            const focusedBlockState = vault.noteBlocksApp.focusedBlock.state;

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
              scope.setSelectionInterval(focusedBlockState.viewId, fromBlockId);
              vault.noteBlocksApp.focusedBlock.setState(undefined);

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
                    vault.noteBlocksApp.focusedBlock.setState(undefined);

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
    }, [scope, vault.noteBlocksApp.focusedBlock]);

    const isSelecting = scope.selectionInterval !== undefined;

    useEffect(() => {
      if (!isSelecting) return;

      const handler = () => {
        navigator.clipboard.writeText(scope.getStringTreeToCopy());
      };

      document.addEventListener('copy', handler);

      return () => document.removeEventListener('copy', handler);
    }, [isSelecting, scope]);

    useEffect(() => {
      if (!isSelecting) return;
      const handler = () => {
        const selectedIds = scope.selectedIds;

        navigator.clipboard.writeText(scope.getStringTreeToCopy());

        registry.deleteNoteBlockIds(selectedIds);
      };

      document.addEventListener('cut', handler);

      return () => document.removeEventListener('cut', handler);
    }, [isSelecting, note, vault, scope, registry]);

    useEffect(() => {
      if (!isSelecting) return;

      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          registry.deleteNoteBlockIds(scope.selectedIds);
        }
      };

      document.addEventListener('keydown', handler);

      return () => document.removeEventListener('keydown', handler);
    }, [isSelecting, note, registry, scope]);

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
            ?.id !== focusedBlock.state.viewId
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
