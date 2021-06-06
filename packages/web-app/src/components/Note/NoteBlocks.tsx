import type { NoteBlockModel, BlocksViewModel } from '@harika/web-core';
import { observer } from 'mobx-react-lite';
import React, { useEffect } from 'react';
import { useMedia } from 'react-use';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import type { Ref } from 'mobx-keystone';
import { Toolbar } from './Toolbar';
import { EMPTY, fromEvent, merge, OperatorFunction } from 'rxjs';
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

export const NoteBlocks = observer(
  ({
    childBlocks,
    view,
  }: {
    childBlocks: Ref<NoteBlockModel>[];
    view: BlocksViewModel;
  }) => {
    const vault = useCurrentVault();
    const isWide = useMedia('(min-width: 768px)');

    useEffect(() => {
      const mouseMove$ = fromEvent<MouseEvent>(document, 'mousemove');
      const mouseUp$ = fromEvent<MouseEvent>(document, 'mouseup');
      const mouseDown$ = fromEvent<MouseEvent>(document, 'mousedown');

      const idOnMouseMove$ = mouseMove$.pipe(
        map((e) => {
          const el2 = (e.target as HTMLElement).closest<HTMLDivElement>(
            `[data-type="note-block"][data-view-id="${view.$modelId}"]`,
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
              `[data-type="note-block"][data-view-id="${view.$modelId}"]`,
            );

            return { fromBlockId: el?.dataset?.id, shiftKey: e.shiftKey };
          }),
          switchMap(({ fromBlockId, shiftKey }) => {
            if (!fromBlockId) {
              if (view.selectionInterval !== undefined) {
                view.resetSelection();
              }

              return EMPTY;
            }

            const focusedBlockState = vault.ui.focusedBlock.state;

            const resetAnySelection$ = mouseMove$.pipe(
              tap(() => {
                if (view.selectionInterval !== undefined) {
                  window.getSelection()?.removeAllRanges();
                }
              }),
              takeUntil(mouseUp$),
            );

            // shift+click handling
            if (
              focusedBlockState &&
              focusedBlockState.viewId === view.$modelId &&
              focusedBlockState.isEditing === true &&
              view.selectionInterval === undefined &&
              shiftKey
            ) {
              view.setSelectionInterval(focusedBlockState.blockId, fromBlockId);
              vault.ui.focusedBlock.setState(undefined);

              return EMPTY;
            }

            if (view.selectionInterval !== undefined && shiftKey) {
              view.expandSelection(fromBlockId);

              return merge(
                idOnMouseMove$.pipe(
                  tap((toId) => {
                    view.expandSelection(toId);
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
                      view.selectionInterval &&
                      isEqual(
                        [...view.selectionInterval].sort(),
                        [fromBlockId, toId].sort(),
                      )
                    ) {
                      return;
                    }

                    view.setSelectionInterval(fromBlockId, toId);
                    vault.ui.focusedBlock.setState(undefined);

                    wasAnyIdSelected = true;
                  }),
                  finalize(() => {
                    if (!wasAnyIdSelected) {
                      view.resetSelection();
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
    }, [vault.ui.focusedBlock, view]);

    const isSelecting = view.selectionInterval !== undefined;

    useEffect(() => {
      if (isSelecting) {
        const handler = () => {
          navigator.clipboard.writeText(view.getStringTreeToCopy());
        };

        document.addEventListener('copy', handler);

        return () => document.removeEventListener('copy', handler);
      }
    }, [isSelecting, view]);

    return (
      <>
        <div className="note__body">
          {childBlocks.map((noteBlock) => (
            <NoteBlock
              key={noteBlock.current.$modelId}
              noteBlock={noteBlock.current}
              view={view}
            />
          ))}
        </div>
        {!isWide && <Toolbar view={view} />}
      </>
    );
  },
);
