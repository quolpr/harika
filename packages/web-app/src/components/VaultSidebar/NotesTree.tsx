import React, { useCallback } from 'react';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import type { TreeNodeModel } from '@harika/web-core';
import { cn } from '../../utils';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import ArrowDown from '../../icons/arrow-down.svgr.svg';
import ArrowRight from '../../icons/arrow-right.svgr.svg';
import { observer } from 'mobx-react-lite';
import { usePrimaryNoteId } from '../../hooks/usePrimaryNote';

const treeClass = cn('notes-tree');
const sidebarItemClass = cn('sidebar-item');

const NoteNode = observer(({ node }: { node: TreeNodeModel }) => {
  const vault = useCurrentVault();
  const primaryNoteId = usePrimaryNoteId();
  const isFocused = primaryNoteId ? primaryNoteId === node.noteId : false;

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      node.toggleExpand();
    },
    [node],
  );

  const nodeInfoChild = (
    <>
      <button
        className={treeClass('expand-arrow-container', {
          invisible: node.nodeRefs.length === 0,
        })}
        onClick={handleExpandClick}
      >
        {node.isExpanded ? <ArrowDown /> : <ArrowRight />}
      </button>
      <div className={treeClass('node-title')}>{node.title}</div>
    </>
  );

  const createNoteAndGo = useCallback(() => {}, []);

  return (
    <div className={treeClass('node')}>
      {node.noteId ? (
        <Link
          to={paths.vaultNotePath({
            vaultId: vault.$modelId,
            noteId: node.noteId,
          })}
          className={`${sidebarItemClass({ active: isFocused })} ${treeClass(
            'node-info',
            {
              active: isFocused,
            },
          )}`}
        >
          {nodeInfoChild}
        </Link>
      ) : (
        <button
          className={`${sidebarItemClass({ active: isFocused })} ${treeClass(
            'node-info',
            {
              active: isFocused,
            },
          )}`}
          onClick={createNoteAndGo}
        >
          {nodeInfoChild}
        </button>
      )}

      {node.nodeRefs.length !== 0 && node.isExpanded && (
        <div
          className={treeClass('node-children', { 'with-left-margin': true })}
        >
          {node.nodeRefs.map((nodeRef) => (
            <NoteNode node={nodeRef.current} key={nodeRef.id} />
          ))}
        </div>
      )}
    </div>
  );
});

export const NotesTree = observer(() => {
  const vault = useCurrentVault();

  const rootNode = vault.notesTree.rootNodeRef.current;

  return (
    <div className={treeClass()}>
      <div
        className={treeClass('node-children')}
        style={{ overflow: 'scroll' }}
      >
        {rootNode.nodeRefs.map((nodeRef) => (
          <NoteNode node={nodeRef.current} key={nodeRef.id} />
        ))}
      </div>
    </div>
  );
});
