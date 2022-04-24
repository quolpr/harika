import { getBlockView } from '@harika/web-core';
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
import tw, { styled } from 'twin.macro';
import useResizeObserver from 'use-resize-observer/polyfilled';

import { CurrentBlockInputRefContext } from '../../contexts';
import { FooterRefContext } from '../../contexts/FooterRefContext';
import { useBlockFocusState } from '../../hooks/useBlockFocusState';
import {
  useBlocksScopesStore,
  useBlocksStore,
} from '../../hooks/vaultAppHooks';
import { cn, insertText } from '../../utils';

const toolbarClass = cn('toolbar');

const ToolbarStyled = styled.div`
  ${tw`bg-gray-900 bg-opacity-90`}
  display: flex;
  position: relative;

  backdrop-filter: blur(5px);
`;
const ToolbarContent = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: center;

  width: 100%;
`;
const ToolbarBtn = styled.button`
  height: 4rem;

  flex: 1;
`;

export const Toolbar = observer(() => {
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

  const scopeStore = useBlocksScopesStore();
  const blocksStore = useBlocksStore();
  const focusState = useBlockFocusState();

  const scope = focusState.currentFocus
    ? scopeStore.getScopeById(focusState.currentFocus?.scopeId)
    : undefined;
  const block = focusState.currentFocus
    ? blocksStore.getBlockById(focusState.currentFocus.blockId)
    : undefined;

  const currentBlock = scope && block ? getBlockView(scope, block) : undefined;

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
        <ToolbarStyled className={toolbarClass()} ref={elRef}>
          <ToolbarContent className={toolbarClass('content')}>
            <ToolbarBtn
              className={toolbarClass('button')}
              onMouseDown={handleCommandPress}
              aria-label="Show editor command"
            >
              /
            </ToolbarBtn>
            <ToolbarBtn
              className={toolbarClass('button')}
              onMouseDown={handleTodoPress}
              aria-label="Add TODO"
            >
              <CheckBox />
            </ToolbarBtn>
            <ToolbarBtn
              className={toolbarClass('button')}
              onMouseDown={handleBracketPress}
              aria-label="Add note ref"
            >
              [[
            </ToolbarBtn>
            <ToolbarBtn
              onMouseDown={handleMoveDownPress}
              className={toolbarClass('button')}
              aria-label="Increase indent"
            >
              <FormatIndentDecrease />
            </ToolbarBtn>
            <ToolbarBtn
              onMouseDown={handleMoveUpPress}
              className={toolbarClass('button')}
              aria-label="Decrease indent"
            >
              <FormatIndentIncrease />
            </ToolbarBtn>
            <ToolbarBtn
              onMouseDown={handleMoveRight}
              className={toolbarClass('button')}
              aria-label="Move down"
            >
              <ArrowDropDown />
            </ToolbarBtn>
            <ToolbarBtn
              onMouseDown={handleMoveLeft}
              className={toolbarClass('button')}
              aria-label="Move up"
            >
              <ArrowDropUp />
            </ToolbarBtn>

            {/* <button */}
            {/*   className={toolbarClass('button')} */}
            {/*   data-defocus */}
            {/*   aria-label="Hide keyboard" */}
            {/* > */}
            {/*   <KeyboardHide /> */}
            {/* </button> */}
          </ToolbarContent>
        </ToolbarStyled>,
        footerRef.current,
      )) ||
    null
  );
});
