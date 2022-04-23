import React, { useCallback, useEffect, useRef } from 'react';
import { styled } from 'twin.macro';

import { sidebarClass } from './VaultSidebar';

// Based on https://github.com/LeetCode-OpenSource/react-simple-resizer/blob/d8e38ba8489e2f2de414f42eb3666b585a31dac4/src/Bar/index.tsx

export enum ResizeActionType {
  ACTIVATE = 'activate',
  MOVE = 'move',
  DEACTIVATE = 'deactivate',
}

const ResizeStyled = styled.div`
  position: absolute;
  top: 0;
  right: 0px;
  width: 3px;
  margin-right: -3px;
  height: 100%;
  background-color: #222;
  cursor: col-resize;
  user-select: none;
`;

export const Resizer = ({
  onResize,
  currentWidth,
  currentHeight,
}: {
  currentWidth: number;
  currentHeight: number;
  onResize: (
    width: number,
    height: number,
    actionType: ResizeActionType,
  ) => void;
}) => {
  const stateRef = useRef<{
    startedAt: { x: number; y: number; width: number; height: number };
  } | null>();
  const resizerRef = useRef<HTMLDivElement | null>(null);

  const disableUserSelectIfResizing = useCallback(
    (
      event: React.MouseEvent | MouseEvent | React.TouchEvent | TouchEvent,
      type: ResizeActionType,
    ) => {
      if (stateRef.current || type === ResizeActionType.ACTIVATE) {
        event.preventDefault();
      }
    },
    [],
  );

  // We muse be sure that on onResize props change the listeners
  // will be not be resubscribed. Its better to avoid all resubscribtions
  const onResizeRef = useRef(onResize);
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);
  const widthRef = useRef(currentWidth);
  useEffect(() => {
    widthRef.current = currentWidth;
  }, [currentWidth]);
  const heightRef = useRef(currentHeight);
  useEffect(() => {
    heightRef.current = currentHeight;
  }, [currentHeight, currentWidth]);

  const triggerAction = useCallback(
    (type: ResizeActionType, { x, y }: { x: number; y: number }) => {
      if (type === ResizeActionType.ACTIVATE) {
        stateRef.current = {
          startedAt: {
            x,
            y,
            width: widthRef.current,
            height: heightRef.current,
          },
        };
      }

      if (stateRef.current) {
        const state = stateRef.current;
        onResizeRef.current(
          state.startedAt.width + x - state.startedAt.x,
          state.startedAt.height + y - state.startedAt.y,
          type,
        );
      }

      if (type === ResizeActionType.DEACTIVATE) {
        stateRef.current = null;
      }
    },
    [],
  );

  const handleTouch = useCallback(
    (actionType: ResizeActionType) => (event: React.TouchEvent | TouchEvent) => {
      disableUserSelectIfResizing(event, actionType);
      const touch = event.touches[0] || { clientX: 0, clientY: 0 };
      const { clientX: x, clientY: y } = touch;
      triggerAction(actionType, { x, y });
    },
    [disableUserSelectIfResizing, triggerAction],
  );

  const handleMouse = useCallback(
    (actionType: ResizeActionType) => (event: React.MouseEvent | MouseEvent) => {
      disableUserSelectIfResizing(event, actionType);
      const { clientX: x, clientY: y } = event;
      triggerAction(actionType, { x, y });
    },
    [disableUserSelectIfResizing, triggerAction],
  );

  useEffect(() => {
    const resizerDiv = resizerRef.current;

    const mouseMove = handleMouse(ResizeActionType.MOVE);
    const mouseUp = handleMouse(ResizeActionType.DEACTIVATE);
    const mouseDown = handleMouse(ResizeActionType.ACTIVATE);

    const touchMove = handleTouch(ResizeActionType.MOVE);
    const touchEnd = handleTouch(ResizeActionType.DEACTIVATE);
    const touchCancel = handleTouch(ResizeActionType.DEACTIVATE);
    const touchStart = handleTouch(ResizeActionType.ACTIVATE);

    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('mouseup', mouseUp);
    document.addEventListener('touchmove', touchMove, {
      passive: false,
    });
    document.addEventListener('touchend', touchEnd);
    document.addEventListener('touchcancel', touchCancel);

    if (resizerDiv) {
      resizerDiv.addEventListener('mousedown', mouseDown);
      resizerDiv.addEventListener(
        'touchstart',
        handleTouch(ResizeActionType.ACTIVATE),
        { passive: false },
      );
    }
    return () => {
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseUp);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);
      document.removeEventListener('touchcancel', touchCancel);

      if (resizerDiv) {
        resizerDiv.removeEventListener('mousedown', mouseDown);
        resizerDiv.removeEventListener('touchstart', touchStart);
      }
    };
  }, [handleMouse, handleTouch]);

  return <ResizeStyled className={sidebarClass('resizer')} ref={resizerRef} />;
};
