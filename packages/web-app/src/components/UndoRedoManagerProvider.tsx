import { UndoManager, undoMiddleware } from 'mobx-keystone';
import React, { useEffect, useRef } from 'react';
import { createContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useRootStore } from '../hooks/vaultAppHooks';
import { useNavigateRef } from '../utils';

const UndoRedoContext = createContext<UndoManager>(
  undefined as unknown as UndoManager,
);

interface AttachedState {
  currentPath: string;
}

export const UndoRedoManagerProvider: React.FC = ({ children }) => {
  let navigate = useNavigateRef();
  let location = useLocation();

  const rootStore = useRootStore();
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [navigate, location]);

  const manager = useMemo(() => {
    return undoMiddleware(rootStore, undefined, {
      attachedState: {
        save(): AttachedState {
          return {
            currentPath: locationRef.current.pathname,
          };
        },
        restore(attachedState: AttachedState) {
          if (attachedState.currentPath !== locationRef.current.pathname) {
            navigate.current(attachedState.currentPath, { replace: true });
          }
        },
      },
    });
  }, [navigate, rootStore]);

  useEffect(() => {
    const listener = function (event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.code === 'KeyZ'
      ) {
        if (manager.canRedo) {
          manager.redo();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        if (manager.canUndo) {
          manager.undo();
        }
      }
    };

    document.addEventListener('keydown', listener);

    return () => {
      document.removeEventListener('keydown', listener);
    };
  });

  return (
    <UndoRedoContext.Provider value={manager}>
      {children}
    </UndoRedoContext.Provider>
  );
};
