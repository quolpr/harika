import React from 'react';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import type { TreeNodeModel } from '@harika/web-core';
import { cn } from '../../utils';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import NoteIcon from '../../icons/note.svgr.svg';
import TagIcon from '../../icons/tag.svgr.svg';

const treeClass = cn('notes-tree');
const sidebarItemClass = cn('sidebar-item');

const NoteNode = ({ node }: { node: TreeNodeModel }) => {
  const vault = useCurrentVault();

  const isActive = node.isFocused;

  const nodeInfoChild = (
    <>
      <div
        className={treeClass('expand-arrow-container', { lighter: isActive })}
      ></div>
      <div className={treeClass('node-icon')}>
        {node.noteId ? <NoteIcon /> : <TagIcon />}
      </div>
      <div className={treeClass('node-title')}>{node.title}</div>
    </>
  );

  return (
    <div className={treeClass('node')}>
      {node.noteId ? (
        <Link
          to={paths.vaultNotePath({
            vaultId: vault.$modelId,
            noteId: node.noteId,
          })}
          className={`${sidebarItemClass({ active: isActive })} ${treeClass(
            'node-info',
            {
              active: isActive,
            },
          )}`}
        >
          {nodeInfoChild}
        </Link>
      ) : (
        <div
          className={`${sidebarItemClass({ active: isActive })} ${treeClass(
            'node-info',
            {
              active: isActive,
            },
          )}`}
        >
          {nodeInfoChild}
        </div>
      )}

      {node.nodeRefs.length !== 0 && (
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
};

export const NotesTree = () => {
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
};
