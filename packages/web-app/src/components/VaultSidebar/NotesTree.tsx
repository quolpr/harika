import type { NotesTreeNote } from '@harika/web-core';
import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { css, styled } from 'twin.macro';

import {
  useHandleNoteClickOrPress,
  useNotePath,
} from '../../contexts/StackedNotesContext';
import { usePrimaryNoteId } from '../../hooks/usePrimaryNote';
import {
  useNoteBlocksService,
  useNotesTreeRegistry,
} from '../../hooks/vaultAppHooks';
import ArrowDown from '../../icons/arrow-down.svgr.svg?component';
import ArrowRight from '../../icons/arrow-right.svgr.svg?component';
import { cn, useNavigateRef } from '../../utils';
import { SidebarItemDiv } from './styles';

const treeClass = cn('notes-tree');
const sidebarItemClass = cn('sidebar-item');

const TreeStyled = styled.div`
  font-family: Roboto;
  font-style: normal;
  font-weight: normal;
`;

const NodeChildren = styled.div<{ withLeftMargin?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;

  ${({ withLeftMargin: withLeft }) =>
    withLeft &&
    css`
      margin-left: 14px;
    `}
`;

const NodeTitleLink = styled(Link)`
  text-overflow: ellipsis;

  overflow: hidden;
  white-space: nowrap;
  min-width: 0;
  text-align: left;

  width: 100%;
  height: 100%;

  display: flex;
  align-items: center;
`;

const NodeTitleBtn = NodeTitleLink.withComponent('button');

const NodeInfo = styled(SidebarItemDiv)`
  width: 100%;
  border-radius: 5px;

  transition: background-color 0.05s ease-out;

  &:hover {
    background: #535354;
  }

  ${({ isActive }) =>
    isActive &&
    css`
      background: #535354;
    `}
`;

const ExpandContainer = styled.button`
  height: 100%;
`;

const ArrowContainer = styled.div<{ invisible?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;
  width: 12px;
  height: 12px;
  margin: 0 8px;

  cursor: pointer;

  transition: background-color 0.25s ease;
  border-radius: 2px;

  ${({ invisible }) =>
    invisible &&
    css`
      visibility: hidden;
    `}
`;

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
    const navigate = useNavigateRef();
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

          navigate.current(notePath(newNote.data.$modelId));
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
        <NodeInfo
          className={`${sidebarItemClass({ active: isFocused })} ${treeClass(
            'node-info',
            {
              active: isFocused,
            },
          )}`}
          isActive={isFocused}
        >
          <ExpandContainer
            className={treeClass('expand-container')}
            onClick={handleExpandClick}
          >
            <ArrowContainer
              className={treeClass('expand-arrow-container', {
                invisible: node.nodeRefs.length === 0,
              })}
              invisible={node.nodeRefs.length === 0}
            >
              {node.isExpanded ? <ArrowDown /> : <ArrowRight />}
            </ArrowContainer>
          </ExpandContainer>

          {node.noteId ? (
            <NodeTitleLink
              to={notePath(node.noteId)}
              onClick={handleLinkClick}
              className={treeClass('node-title')}
            >
              {node.title}
            </NodeTitleLink>
          ) : (
            <NodeTitleBtn
              className={treeClass('node-title')}
              onClick={createNoteAndGo}
            >
              {node.title}
            </NodeTitleBtn>
          )}
        </NodeInfo>

        {node.nodeRefs.length !== 0 && node.isExpanded && (
          <NodeChildren className={treeClass('node-children')} withLeftMargin>
            {node.sortedChildNodes.map((node) => (
              <NoteNode
                onNavClick={onNavClick}
                node={node}
                key={node.$modelId}
              />
            ))}
          </NodeChildren>
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
      <TreeStyled className={treeClass()}>
        <NodeChildren className={treeClass('node-children')}>
          {rootNode.sortedChildNodes.map((node) => (
            <NoteNode onNavClick={onNavClick} node={node} key={node.$modelId} />
          ))}
        </NodeChildren>
      </TreeStyled>
    );
  },
);
