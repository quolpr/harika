import { Pos } from 'caret-pos';
import React from 'react';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import scrollIntoView from 'scroll-into-view-if-needed';
import tw, { styled } from 'twin.macro';
import useResizeObserver from 'use-resize-observer';

import { bem } from '../../../../utils';

export type IDropdownItem = {
  id: string;
  title: string;
};

export const editorDropdownClass = bem('editorDropdown');

const EditorDropdownStyled = styled.div`
  position: absolute;
`;

const Container = styled.div`
  ${tw`bg-gray-800 rounded-md bg-opacity-80 py-2`}

  position: absolute;

  z-index: 1000;
`;

const Content = styled.ul`
  max-height: calc(1.75rem * 8);
  width: 15rem;

  overflow-y: auto;
  overflow-x: hidden;

  -webkit-overflow-scrolling: auto;
`;

const Item = styled.li<{ focused: boolean }>`
  ${tw`px-2 h-7`}

  display: flex;
  align-items: center;

  cursor: pointer;

  &:first-child {
    ${tw`pt-0`}
  }

  &:last-child {
    ${tw`pb-0`}
  }

  ${({ focused }) => focused && tw`bg-gray-700`}
`;

const ItemContent = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const EditorDropdown = <T extends IDropdownItem>({
  items,
  holderRef,
  onClick,
  onTabOrEnterPress,
  caretPos,
  onEmpty,
}: {
  items: T[];
  holderRef: MutableRefObject<HTMLDivElement | null>;
  onClick: (item: T) => void;
  onTabOrEnterPress: (e: Event, item: T | undefined) => void;
  caretPos: Pos | undefined;
  onEmpty?: React.ReactNode;
}) => {
  const mainElRef = useRef<HTMLDivElement | null>(null);
  const containerElRef = useRef<HTMLDivElement | null>(null);

  const [focusedIdx, setFocusedIdx] = useState<number>(0);
  const itemsRef = useRef<Array<HTMLElement | null>>([]);

  const resultLength = items.length;

  useEffect(() => {
    itemsRef.current = itemsRef.current.slice(0, resultLength);
  }, [resultLength]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const itemsPresent = items.length !== 0;

      const handleNewIndexSet = (newIndex: number) => {
        setFocusedIdx(newIndex);

        const itemEl = itemsRef.current[newIndex];
        if (itemEl) {
          scrollIntoView(itemEl, {
            behavior: 'smooth',
            scrollMode: 'if-needed',
          });
        }
      };

      if (itemsPresent) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();

          const newIndex = focusedIdx + 1 >= items.length ? 0 : focusedIdx + 1;

          handleNewIndexSet(newIndex);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();

          const newIndex =
            focusedIdx - 1 >= 0 ? focusedIdx - 1 : items.length - 1;

          handleNewIndexSet(newIndex);
        }
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        onTabOrEnterPress(e, items[focusedIdx]);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [focusedIdx, items, onTabOrEnterPress]);

  const { width: containerWidth = undefined } =
    useResizeObserver<HTMLDivElement>({
      ref: containerElRef,
    });
  const { width: wrapperWidth = undefined } = useResizeObserver<HTMLDivElement>(
    {
      ref: holderRef,
    },
  );
  const [containerLeftPos, setContainerLeftPos] = useState<undefined | number>(
    undefined,
  );

  useEffect(() => {
    if (
      !mainElRef.current ||
      !containerElRef.current ||
      !caretPos ||
      !containerWidth ||
      !wrapperWidth
    )
      return;

    if (caretPos.left + containerWidth > wrapperWidth) {
      setContainerLeftPos(wrapperWidth - containerWidth);
    } else {
      setContainerLeftPos(caretPos.left);
    }
  }, [caretPos, containerWidth, wrapperWidth]);

  useEffect(() => {
    if (items.length > 0 && focusedIdx >= items.length) {
      const newIndex = items.length - 1;

      setFocusedIdx(newIndex);
    }
  }, [focusedIdx, items]);

  return (
    <EditorDropdownStyled className={editorDropdownClass()} ref={mainElRef}>
      <Container
        className={editorDropdownClass('container')}
        style={{
          visibility: containerLeftPos === undefined ? 'hidden' : 'visible',
          transform: `translateX(${containerLeftPos || 0}px) translateY(${
            (caretPos?.top || 0) + (caretPos?.height || 0)
          }px)`,
        }}
        ref={containerElRef}
      >
        <Content className={editorDropdownClass('content')} role="menu">
          {items.length === 0 && onEmpty}
          {items.map((res, i) => (
            // Already handling
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <Item
              role="menuitem"
              key={res.id}
              focused={focusedIdx === i}
              className={editorDropdownClass('item', {
                focused: focusedIdx === i,
              })}
              onMouseEnter={() => setFocusedIdx(i)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                onClick(res);
              }}
              // Don't trigger blur
              onMouseDown={(e) => e.preventDefault()}
              ref={(el) => (itemsRef.current[i] = el)}
            >
              <ItemContent className={editorDropdownClass('itemContent')}>
                {res.title}
              </ItemContent>
            </Item>
          ))}
        </Content>
      </Container>
    </EditorDropdownStyled>
  );
};
