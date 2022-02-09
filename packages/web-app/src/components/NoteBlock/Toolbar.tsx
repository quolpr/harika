import { BlocksScope, CollapsableBlock } from '@harika/web-core';
import {
  ArrowDropDown,
  ArrowDropUp,
  CheckBox,
  FormatIndentDecrease,
  FormatIndentIncrease,
} from '@material-ui/icons';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useContext, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useUnmount } from 'react-use';
import scrollIntoView from 'scroll-into-view-if-needed';
import useResizeObserver from 'use-resize-observer/polyfilled';

import { CurrentBlockInputRefContext } from '../../contexts';
import { FooterRefContext } from '../../contexts/FooterRefContext';
import { cn, insertText } from '../../utils';

const toolbarClass = cn('toolbar');

export const Toolbar = observer(({ scope }: { scope: BlocksScope }) => {
  const footerRef = useContext(FooterRefContext);

  const currentBlockInputRef = useContext(CurrentBlockInputRefContext);

  const elRef = useRef<HTMLDivElement | null>(null);

  const scrollToInput = useCallback(() => {
    setTimeout(() => {
      if (currentBlockInputRef.current) {
        scrollIntoView(currentBlockInputRef.current, {
          behavior: 'smooth',
        });
      }
    }, 0);
  }, [currentBlockInputRef]);

  // const currentBlock = focusedBlock.state?.scopedBlockId
  //   ? getCollapsableBlock(scope, focusedBlock.state?.scopedBlockId)
  //   : undefined;
  const currentBlock: CollapsableBlock | undefined = undefined as
    | CollapsableBlock
    | undefined;

  const handleTodoPress = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const el = currentBlockInputRef.current;

      if (el) {
        insertText(el, '[[TODO]] ');
      }
    },
    [currentBlockInputRef],
  );

  const handleCommandPress = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const el = currentBlockInputRef.current;

      if (el) {
        insertText(el, '/');
      }
    },
    [currentBlockInputRef],
  );

  const handleBracketPress = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const el = currentBlockInputRef.current;

      if (el) {
        insertText(el, '[[]]', 2);
      }
    },
    [currentBlockInputRef],
  );

  const handleMoveUpPress = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      currentBlock.tryMoveUp();
    },
    [currentBlock],
  );

  const handleMoveDownPress = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      currentBlock.tryMoveDown();
    },
    [currentBlock],
  );

  const handleMoveLeft = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      currentBlock.tryMoveLeft();

      scrollToInput();
    },
    [currentBlock, scrollToInput],
  );

  const handleMoveRight = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();

      if (!currentBlock) return;

      currentBlock.tryMoveRight();

      scrollToInput();
    },
    [currentBlock, scrollToInput],
  );

  useEffect(() => {
    if (!window.visualViewport) return;

    const viewportHandler = (e: Event) => {
      if (elRef.current) {
        const bottomPos = window.innerHeight - window.visualViewport.height;

        // Instead for useState, for faster updates
        elRef.current.style.transform = `translate3d(0px, ${-bottomPos}px, 0px)`;
      }
    };

    window.visualViewport.addEventListener('scroll', viewportHandler);
    window.visualViewport.addEventListener('resize', viewportHandler);
    window.addEventListener('resize', viewportHandler);
    window.addEventListener('scroll', viewportHandler);

    // setInterval(() => {
    //   console.log({ height: window.visualViewport.height });
    // }, 500);

    return () => {
      window.visualViewport.removeEventListener('scroll', viewportHandler);
      window.visualViewport.removeEventListener('resize', viewportHandler);

      window.removeEventListener('resize', viewportHandler);
      window.removeEventListener('scroll', viewportHandler);
    };
  });

  const { height: toolbarHeight = 0 } = useResizeObserver<HTMLDivElement>({
    ref: elRef,
  });

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--vault-footer-height',
      `${toolbarHeight}px`,
    );
  }, [toolbarHeight]);

  useUnmount(() => {
    document.documentElement.style.setProperty('--vault-footer-height', '0px');
  });

  return (
    (footerRef?.current &&
      ReactDOM.createPortal(
        <div className={toolbarClass()} ref={elRef}>
          <div className={toolbarClass('content')}>
            <button
              className={toolbarClass('button')}
              onMouseDown={handleCommandPress}
              aria-label="Show editor command"
            >
              /
            </button>
            <button
              className={toolbarClass('button')}
              onMouseDown={handleTodoPress}
              aria-label="Add TODO"
            >
              <CheckBox />
            </button>
            <button
              className={toolbarClass('button')}
              onMouseDown={handleBracketPress}
              aria-label="Add note ref"
            >
              [[
            </button>
            <button
              onMouseDown={handleMoveDownPress}
              className={toolbarClass('button')}
              aria-label="Increase indent"
            >
              <FormatIndentDecrease />
            </button>
            <button
              onMouseDown={handleMoveUpPress}
              className={toolbarClass('button')}
              aria-label="Decrease indent"
            >
              <FormatIndentIncrease />
            </button>
            <button
              onMouseDown={handleMoveRight}
              className={toolbarClass('button')}
              aria-label="Move down"
            >
              <ArrowDropDown />
            </button>
            <button
              onMouseDown={handleMoveLeft}
              className={toolbarClass('button')}
              aria-label="Move up"
            >
              <ArrowDropUp />
            </button>

            {/* <button */}
            {/*   className={toolbarClass('button')} */}
            {/*   data-defocus */}
            {/*   aria-label="Hide keyboard" */}
            {/* > */}
            {/*   <KeyboardHide /> */}
            {/* </button> */}
          </div>
        </div>,
        footerRef.current,
      )) ||
    null
  );
});
