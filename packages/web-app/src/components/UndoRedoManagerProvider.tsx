import React, { useEffect, useRef } from 'react';
import { UndoManager, undoMiddleware } from 'mobx-keystone';
import { createContext, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRootStore } from '../hooks/vaultAppHooks';

const UndoRedoContext = createContext<UndoManager>(
  undefined as unknown as UndoManager,
);

interface AttachedState {
  currentPath: string;
}

export const UndoRedoManagerProvider: React.FC = ({ children }) => {
  let navigate = useNavigate();
  let location = useLocation();

  const rootStore = useRootStore();
  const historyRef = useRef(navigate);
  const locationRef = useRef(location);

  useEffect(() => {
    historyRef.current = navigate;
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
            historyRef.current(attachedState.currentPath, { replace: true });
          }
        },
      },
    });
  }, [rootStore]);

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
