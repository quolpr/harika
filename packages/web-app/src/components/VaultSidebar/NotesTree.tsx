import React, { useCallback } from 'react';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import type { TreeNodeModel } from '@harika/web-core';
import { cn } from '../../utils';
import { Link, useHistory } from 'react-router-dom';
import { paths } from '../../paths';
import ArrowDown from '../../icons/arrow-down.svgr.svg?component';
import ArrowRight from '../../icons/arrow-right.svgr.svg?component';
import { observer } from 'mobx-react-lite';
import { usePrimaryNoteId } from '../../hooks/usePrimaryNote';
import { useNotesService } from '../../contexts/CurrentNotesServiceContext';

const treeClass = cn('notes-tree');
const sidebarItemClass = cn('sidebar-item');

const NoteNode = observer(
  ({
    node,
    onNavClick,
  }: {
    node: TreeNodeModel;
    onNavClick: (e: React.MouseEvent) => void;
  }) => {
    const vault = useCurrentVault();
    const repo = useNotesService();
    const primaryNoteId = usePrimaryNoteId();
    const isFocused = primaryNoteId
      ? node.isExpanded
        ? primaryNoteId === node.noteId
        : node.isInsideNode(primaryNoteId)
      : false;
    const history = useHistory();

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

        const newNote = await repo.createNote({ title: node.fullTitle });

        if (newNote.status === 'ok') {
          node.setNoteId(newNote.data.$modelId);

          history.push(
            paths.vaultNotePath({
              vaultId: vault.$modelId,
              noteId: newNote.data.$modelId,
            }),
          );
        } else {
          alert('Failed to create note');
        }
      },
      [history, node, onNavClick, repo, vault.$modelId],
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
              to={paths.vaultNotePath({
                vaultId: vault.$modelId,
                noteId: node.noteId,
              })}
              onClick={onNavClick}
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
    const vault = useCurrentVault();

    const rootNode = vault.notesTree.rootNodeRef.current;

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
