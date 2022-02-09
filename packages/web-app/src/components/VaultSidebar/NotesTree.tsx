import React, { useCallback } from 'react';
import type { NotesTreeNote } from '@harika/web-core';
import { cn } from '../../utils';
import { Link, useNavigate } from 'react-router-dom';
import ArrowDown from '../../icons/arrow-down.svgr.svg?component';
import ArrowRight from '../../icons/arrow-right.svgr.svg?component';
import { observer } from 'mobx-react-lite';
import { usePrimaryNoteId } from '../../hooks/usePrimaryNote';
import {
  useNoteBlocksService,
  useNotesTreeRegistry,
} from '../../hooks/vaultAppHooks';
import {
  useHandleNoteClickOrPress,
  useNotePath,
} from '../../contexts/StackedNotesContext';

const treeClass = cn('notes-tree');
const sidebarItemClass = cn('sidebar-item');

const NoteNode = observer(
  ({
    node,
    onNavClick,
  }: {
    node: NotesTreeNote;
    onNavClick: (e: React.MouseEvent) => void;
  }) => {
    const notesService = useNoteBlocksService();
    const primaryNoteId = usePrimaryNoteId();
    const isFocused = primaryNoteId
      ? node.isExpanded
        ? primaryNoteId === node.noteId
        : node.isInsideNode(primaryNoteId)
      : false;
    const navigate = useNavigate();
    const notePath = useNotePath();

    const handleExpandClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();

        node.toggleExpand();
      },
      [node],
    );

    const createNoteAndGo = useCallback(
      async (e: React.MouseEvent) => {
        onNavClick(e);

        const newNote = await notesService.createNote({
          title: node.fullTitle,
        });

        if (newNote.status === 'ok') {
          node.setNoteId(newNote.data.$modelId);

          navigate(notePath(newNote.data.$modelId));
        } else {
          alert('Failed to create note');
        }
      },
      [navigate, node, notePath, notesService, onNavClick],
    );

    const handleClick = useHandleNoteClickOrPress(node.noteId);

    const handleLinkClick = useCallback(
      (e: React.MouseEvent) => {
        handleClick(e);
        onNavClick(e);
      },
      [handleClick, onNavClick],
    );

    return (
      <div className={treeClass('node')}>
        <div
          className={`${sidebarItemClass({ active: isFocused })} ${treeClass(
            'node-info',
            {
              active: isFocused,
            },
          )}`}
        >
          <button
            className={treeClass('expand-container')}
            onClick={handleExpandClick}
          >
            <div
              className={treeClass('expand-arrow-container', {
                invisible: node.nodeRefs.length === 0,
              })}
            >
              {node.isExpanded ? <ArrowDown /> : <ArrowRight />}
            </div>
          </button>

          {node.noteId ? (
            <Link
              to={notePath(node.noteId)}
              onClick={handleLinkClick}
              className={treeClass('node-title')}
            >
              {node.title}
            </Link>
          ) : (
            <button
              className={treeClass('node-title')}
              onClick={createNoteAndGo}
            >
              {node.title}
            </button>
          )}
        </div>

        {node.nodeRefs.length !== 0 && node.isExpanded && (
          <div
            className={treeClass('node-children', { 'with-left-margin': true })}
          >
            {node.sortedChildNodes.map((node) => (
              <NoteNode
                onNavClick={onNavClick}
                node={node}
                key={node.$modelId}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

export const NotesTree = observer(
  ({ onNavClick }: { onNavClick: (e: React.MouseEvent) => void }) => {
    const registry = useNotesTreeRegistry();

    const rootNode = registry.rootNodeRef.current;

    return (
      <div className={treeClass()}>
        <div className={treeClass('node-children')}>
          {rootNode.sortedChildNodes.map((node) => (
            <NoteNode onNavClick={onNavClick} node={node} key={node.$modelId} />
          ))}
        </div>
      </div>
    );
  },
);
