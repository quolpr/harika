import type {
  NoteBlockModel,
  BlocksViewModel,
  FocusedBlockState,
} from '@harika/web-core';
import { observer } from 'mobx-react-lite';
import React, { useEffect } from 'react';
import { useMedia } from 'react-use';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import type { Ref } from 'mobx-keystone';
import { Toolbar } from './Toolbar';
import { EMPTY, fromEvent, OperatorFunction } from 'rxjs';
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

    // TODO: what is the better way to handle both mouse move and shift click?
    useEffect(() => {
      const mouseMove$ = fromEvent<MouseEvent>(document, 'mousemove');
      const mouseUp$ = fromEvent<MouseEvent>(document, 'mouseup');
      const mouseDown$ = fromEvent<MouseEvent>(document, 'mousedown');

      const mouseMoveHandler = mouseDown$
        .pipe(
          switchMap((e) => {
            const el = (e.target as HTMLElement).closest<HTMLDivElement>(
              `[data-type="note-block"][data-view-id="${view.$modelId}"]`,
            );
            const fromBlockId = el?.dataset?.id;

            let shouldExpand = false;
            let wasAnyIdSelected = false;

            if (view.selectionInterval !== undefined) {
              if (
                (!fromBlockId || !view.selectedIds.includes(fromBlockId)) &&
                !e.shiftKey
              ) {
                view.resetSelection();
              }

              if (e.shiftKey && fromBlockId) {
                view.expandSelection(fromBlockId);

                wasAnyIdSelected = true;
                shouldExpand = true;
              }
            }

            let wasDifferentBlockIdSelected =
              view.selectionInterval !== undefined;

            if (fromBlockId) {
              return mouseMove$.pipe(
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
                filter(
                  (toId) =>
                    !(toId === fromBlockId && !wasDifferentBlockIdSelected),
                ),
                tap((toId) => {
                  if (shouldExpand) {
                    view.expandSelection(toId);
                  } else {
                    view.setSelectionInterval(fromBlockId, toId);

                    wasDifferentBlockIdSelected = true;
                  }

                  wasAnyIdSelected = true;
                }),
                finalize(() => {
                  if (
                    !wasAnyIdSelected &&
                    view.selectionInterval !== undefined
                  ) {
                    view.resetSelection();
                  }
                }),
                takeUntil(mouseUp$),
              );
            } else {
              return EMPTY;
            }
          }),
        )
        .subscribe();

      const shiftClickHandler = mouseDown$
        .pipe(
          map((e): [MouseEvent, FocusedBlockState | undefined] => [
            e,
            vault.ui.focusedBlock,
          ]),
          filter(([, focusedBlock]) => focusedBlock?.viewId === view.$modelId),
          filter(([e]) => e.shiftKey),
          map(([e, focusedBlock]): [string | undefined, FocusedBlockState] => {
            const el = (e.target as HTMLElement).closest<HTMLDivElement>(
              `[data-type="note-block"][data-view-id="${view.$modelId}"]`,
            );
            return [el?.dataset?.id, focusedBlock as FocusedBlockState];
          }),
        )
        .subscribe(([id, focusedBlock]) => {
          if (!id) {
            return;
          }

          if (
            view.selectionInterval &&
            isEqual(
              [...view.selectionInterval].sort(),
              [id, focusedBlock.blockId].sort(),
            )
          ) {
            return;
          }

          setTimeout(() => {
            view.setSelectionInterval(focusedBlock.blockId, id);
          }, 0);
        });

      return () => {
        mouseMoveHandler.unsubscribe();
        shiftClickHandler.unsubscribe();
      };
    }, [vault.ui.focusedBlock, view]);

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
