import {
  BlocksScope,
  BlockView,
  getBlocksSelection,
  NoteBlock,
} from '@harika/web-core';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import tw, { css, styled } from 'twin.macro';

import {
  useHandleNoteClickOrPress,
  useNotePath,
} from '../../contexts/StackedNotesContext';
import { Arrow } from '../Arrow/Arrow';
import { TextBlockComponent } from '../TextBlock/TextBlock';
import { BlocksHandlers } from './BlocksHandlers';

const LinkedBlockStyled = styled.div`
  ${tw`bg-gray-800 mt-3 px-4 py-2 rounded-md shadow-sm`}

  &:first-child {
    ${tw`mt-0`}
  }

  .text-block__child-blocks::before {
    ${tw`bg-gray-700`}
  }
`;

const Path = styled.div`
  ${tw`mb-2`}
`;

const PathStep = styled.div<{ last: boolean }>`
  display: inline;
  word-break: break-all;

  &:after {
    ${tw`mx-1.5`}

    content: '->';

    white-space: nowrap;
  }

  ${({ last }) =>
    last &&
    css`
      &:after {
        content: '';
      }
    `}
`;

const LinkedBlock = observer(
  ({
    rootBlock,
    scope,
  }: {
    rootBlock: BlockView;
    scope: BlocksScope;
  }): JSX.Element => {
    const path = rootBlock.path;

    const blocksSelection =
      scope && rootBlock && getBlocksSelection(scope, rootBlock);

    return (
      <LinkedBlockStyled className="backlinked-note__noteblock-root">
        {path.length > 1 && (
          <Path className="backlinked-note__noteblock-path">
            {path.slice(1).map((n, i) => (
              <PathStep
                className={clsx('backlinked-note__noteblock-path-step', {
                  'backlinked-note__noteblock-path-step--last':
                    i === path.length - 1,
                })}
                last={i === path.length - 1}
                key={n.$modelId}
              >
                {n.originalBlock.toString().trim().length === 0
                  ? '[blank]'
                  : n.originalBlock.toString()}
              </PathStep>
            ))}
          </Path>
        )}

        <BlocksHandlers rootBlock={rootBlock} scope={scope} />

        <TextBlockComponent
          block={rootBlock}
          scope={scope}
          blocksSelection={blocksSelection}
        />
      </LinkedBlockStyled>
    );
  },
);

const BacklinkedNoteStyled = styled.div`
  ${tw`mt-5`}
  position: relative;
`;

const Title = styled.div`
  display: flex;
`;

const ArrowStyled = styled(Arrow)`
  ${tw`mr-2.5`}
  transform: translateY(-0.23rem);

  &.arrow--expanded {
    transform: translateY(-0.3rem);
  }
`;

const NoteBlocks = styled.div<{ expanded: boolean }>`
  ${tw`ml-4 mt-3`}
  display: none;

  ${({ expanded }) =>
    expanded &&
    css`
      display: block;
    `}
`;

export const BacklinkedNote = observer(
  ({
    note,
    scopesWithBlocks,
  }: {
    note: NoteBlock;
    scopesWithBlocks: { scope: BlocksScope; rootBlock: BlockView }[];
  }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const notePath = useNotePath();
    const handleClick = useHandleNoteClickOrPress(note?.$modelId);

    return (
      <BacklinkedNoteStyled className="backlinked-note">
        <Title
          className={clsx('backlinked-note__title', {
            'backlinked-note__title--expanded': isExpanded,
          })}
        >
          <ArrowStyled
            className="backlinked-note__arrow"
            isExpanded={isExpanded}
            onToggle={() => {
              setIsExpanded(!isExpanded);
            }}
          />
          <Link to={note ? notePath(note.$modelId) : ''} onClick={handleClick}>
            {note.title}
          </Link>
        </Title>

        <NoteBlocks
          className={clsx('backlinked-note__noteblocks', {
            'backlinked-note__noteblocks--expanded': isExpanded,
          })}
          expanded={isExpanded}
        >
          {scopesWithBlocks.map(({ scope, rootBlock }) => (
            <LinkedBlock
              key={rootBlock.$modelId}
              scope={scope}
              rootBlock={rootBlock}
            />
          ))}
        </NoteBlocks>
      </BacklinkedNoteStyled>
    );
  },
);
