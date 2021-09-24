import { Pos } from 'caret-pos';
import React from 'react';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import scrollIntoView from 'scroll-into-view-if-needed';
import useResizeObserver from 'use-resize-observer';
import { bem } from '../../utils';
import './styles.css';

export type IDropdownItem = {
  id: string;
  title: string;
};

export const editorDropdownClass = bem('editorDropdown');

export const EditorDropdown = ({
  items,
  holderRef,
  onClick,
  onTabOrEnterPress,
  caretPos,
  onEmpty,
}: {
  items: IDropdownItem[];
  holderRef: MutableRefObject<HTMLDivElement | null>;
  onClick: (item: IDropdownItem) => void;
  onTabOrEnterPress: (e: Event, item: IDropdownItem | undefined) => void;
  caretPos: Pos | undefined;
  onEmpty: React.ReactNode;
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
            focusedIdx - 1 > 0 ? focusedIdx - 1 : items.length - 1;

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

  const { width: containerWidth = 0 } = useResizeObserver<HTMLDivElement>({
    ref: containerElRef,
  });
  const { width: wrapperWidth = 0 } = useResizeObserver<HTMLDivElement>({
    ref: holderRef,
  });
  const [containerLeftPos, setContainerLeftPos] = useState(0);

  useEffect(() => {
    if (!mainElRef.current || !containerElRef.current || !caretPos) return;

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
    <div className={editorDropdownClass()} ref={mainElRef}>
      <div
        className={editorDropdownClass('container')}
        style={{
          transform: `translateX(${containerLeftPos}px) translateY(${
            (caretPos?.top || 0) + (caretPos?.height || 0)
          }px)`,
        }}
        ref={containerElRef}
      >
        <ul className={editorDropdownClass('content')} role="menu">
          {items.length === 0 && onEmpty}
          {items.map((res, i) => (
            // Already handling
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              role="menuitem"
              key={res.id}
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
              <div className={editorDropdownClass('itemContent')}>
                {res.title}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
