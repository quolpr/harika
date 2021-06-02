import type { NoteBlockModel, BlocksViewModel } from '@harika/web-core';
import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, useCallback } from 'react';
import { useMedia } from 'react-use';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import type { Ref } from 'mobx-keystone';
import { Toolbar } from './Toolbar';

export const NoteBlocks = observer(
  ({
    childBlocks,
    view,
  }: {
    childBlocks: Ref<NoteBlockModel>[];
    view: BlocksViewModel;
  }) => {
    const isWide = useMedia('(min-width: 768px)');
    const [fromId, setFromId] = useState<undefined | string>();
    const [toId, setToId] = useState<undefined | string>();

    useEffect(() => {
      const listener = () => {
        setFromId(undefined);
      };
      document.addEventListener('mouseup', listener);

      return () => document.removeEventListener('mouseup', listener);
    });

    useEffect(() => {
      if (fromId && toId) {
        view.selectInterval(fromId, toId);
      }
    }, [fromId, toId, view]);

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        const el = (e.target as HTMLElement).closest<HTMLDivElement>(
          '[data-type="note-block"]',
        );

        if (el && el.dataset.id) {
          setFromId(el.dataset.id);
        }
      },
      [],
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (!fromId) return;

        const el = (e.target as HTMLElement).closest<HTMLDivElement>(
          '[data-type="note-block"]',
        );

        if (el && el.dataset.id) {
          setToId(el.dataset.id);
        }
      },
      [fromId],
    );

    return (
      <>
        <div // eslint-disable-line jsx-a11y/no-static-element-interactions
          className="note__body"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        >
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
