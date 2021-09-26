import React, { useEffect, useRef } from 'react';
import { NotesService } from '@harika/web-core';
import { UndoManager, undoMiddleware } from 'mobx-keystone';
import { createContext, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

const UndoRedoContext = createContext<UndoManager>(
  undefined as unknown as UndoManager,
);

interface AttachedState {
  currentPath: string;
}

export const UndoRedoManagerProvider: React.FC<{ notesService: NotesService }> =
  ({ notesService, children }) => {
    let history = useHistory();
    let location = useLocation();

    const historyRef = useRef(history);
    const locationRef = useRef(location);

    useEffect(() => {
      historyRef.current = history;
      locationRef.current = location;
    }, [history, location]);

    const manager = useMemo(() => {
      return undoMiddleware(notesService.vault, undefined, {
        attachedState: {
          save(): AttachedState {
            return {
              currentPath: locationRef.current.pathname,
            };
          },
          restore(attachedState: AttachedState) {
            if (attachedState.currentPath !== locationRef.current.pathname) {
              historyRef.current.replace(attachedState.currentPath);
            }
          },
        },
      });
    }, [notesService.vault]);

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
