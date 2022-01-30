import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  NoteRefToken,
  Token,
  TagToken,
  NoteBlock,
  CollapsableBlock,
  toggleTodo,
} from '@harika/web-core';
import { useObservable, useObservableState } from 'observable-hooks';
import { switchMap } from 'rxjs';
import { useDeepMemo } from '../../utils';
import { TextBlockRef } from '@harika/web-core/src/lib/blockParser/types';
import {
  useNoteBlocksService,
  useUpdateLinkService,
} from '../../hooks/vaultAppHooks';
import {
  useHandleNoteClickOrPress,
  useNotePath,
} from '../../contexts/StackedNotesContext';
import { TextBlock } from '@harika/web-core';

const NoteRefRenderer = observer(
  ({
    token,
    linkedNotes,
    collapsableBlock,
  }: {
    token: NoteRefToken;
    collapsableBlock: CollapsableBlock<TextBlock>;
    linkedNotes: NoteBlock[];
  }) => {
    const updateLinksService = useUpdateLinkService();

    const handleTodoToggle = useCallback(
      (e: React.SyntheticEvent) => {
        e.stopPropagation();

        updateLinksService.updateBlockLinks(
          toggleTodo(
            collapsableBlock.originalBlock,
            collapsableBlock,
            token.id,
          ).map(({ $modelId }) => $modelId),
        );
      },
      [collapsableBlock, token.id, updateLinksService],
    );

    const note = linkedNotes.find((n) => {
      return n.title === token.ref;
    });

    const notePath = useNotePath();
    const handleClick = useHandleNoteClickOrPress(note?.$modelId);

    if (token.ref === 'TODO' || token.ref === 'DONE') {
      return (
        <label
          className="checkbox"
          style={{ verticalAlign: 'middle' }}
          data-not-editable
        >
          <span className="hidden-label">Todo</span>

          <input
            type="checkbox"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleTodoToggle(e);
              }
            }}
            checked={token.content === 'DONE'}
            onChange={handleTodoToggle}
            data-not-editable
          />
          <svg className="checkbox__tick" viewBox="0 0 20 20" data-not-editable>
            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
          </svg>
        </label>
      );
    }

    if (!note) return <>{token.alias ? token.alias : token.ref}</>;

    return (
      <Link
        to={notePath(note.$modelId)}
        onClick={handleClick}
        className="link"
        data-not-editable
      >
        {token.alias ? token.alias : token.ref}
      </Link>
    );
  },
);
const BlockRefRenderer = observer(
  ({
    token,
    collapsableBlock,
  }: {
    token: TextBlockRef;
    collapsableBlock: CollapsableBlock;
  }) => {
    // const blocksScopesService = useBlocksScopesService();

    // const linkedBlock$ = useObservable(
    //   ($inputs) => {
    //     return $inputs.pipe(
    //       switchMap(([token, modelId]) =>
    //         token.blockId
    //           ? blocksScopesService.getScopedBlockById$(
    //               token.blockId,
    //               {
    //                 $modelId: modelId,
    //                 $modelType: 'BlockRef',
    //               },
    //               token.blockId,
    //             )
    //           : of(undefined),
    //       ),
    //     );
    //   },
    //   [token, noteBlock.$modelId],
    // );

    // const block = useObservableState(linkedBlock$, undefined);

    // const handleClick = useHandleNoteClickOrPress(block?.noteId, true);

    // const handleEnterPress = useCallback(
    //   (e: React.KeyboardEvent) => {
    //     if (e.key === 'Enter') {
    //       handleClick(e);
    //     }
    //   },
    //   [handleClick],
    // );

    // return (
    //   <span
    //     className="blockRef"
    //     onClick={handleClick}
    //     role="link"
    //     tabIndex={0}
    //     data-not-editable
    //     onKeyPress={handleEnterPress}
    //     data-offset-start={token.offsetStart}
    //     data-offset-end={token.offsetEnd}
    //   >
    //     {block && (
    //       <TokensRenderer noteBlock={block} tokens={block.content.ast} />
    //     )}
    //   </span>
    // );
    return <span />;
  },
);

const TagRenderer = observer(
  ({ token, linkedNotes }: { token: TagToken; linkedNotes: NoteBlock[] }) => {
    const note = linkedNotes.find((n) => {
      return n.title === token.ref;
    });

    const notePath = useNotePath();
    const handleClick = useHandleNoteClickOrPress(note?.$modelId);

    if (!note) return <>#{token.ref}</>;

    return (
      <Link
        to={notePath(note.$modelId)}
        onClick={handleClick}
        className="link link--darker"
        data-not-editable
        data-offset-start={
          token.withBrackets ? token.offsetStart + 5 : token.offsetStart + 1
        }
        data-offset-end={token.offsetEnd}
      >
        #{token.ref}
      </Link>
    );
  },
);

const TokenRenderer = observer(
  ({
    collapsableBlock,
    token,
    linkedNotes,
  }: {
    collapsableBlock: CollapsableBlock<TextBlock>;
    token: Token;
    linkedNotes: NoteBlock[];
  }) => {
    switch (token.type) {
      case 'tag':
        return <TagRenderer token={token} linkedNotes={linkedNotes} />;
      case 'noteRef':
        return (
          <NoteRefRenderer
            collapsableBlock={collapsableBlock}
            token={token}
            linkedNotes={linkedNotes}
          />
        );
      case 'bold':
        return (
          <b>
            <TokensRenderer
              collapsableBlock={collapsableBlock}
              tokens={token.content}
            />
          </b>
        );
      case 'italic':
        return (
          <i>
            <TokensRenderer
              collapsableBlock={collapsableBlock}
              tokens={token.content}
            />
          </i>
        );
      case 'highlight':
        return (
          <mark>
            <TokensRenderer
              collapsableBlock={collapsableBlock}
              tokens={token.content}
            />
          </mark>
        );
      case 'head':
        return (() => {
          if (token.depth === 3) {
            return (
              <h3 className="text-xl">
                <TokensRenderer
                  collapsableBlock={collapsableBlock}
                  tokens={token.content}
                />
              </h3>
            );
          } else if (token.depth === 2) {
            return (
              <h2 className="text-2xl">
                <TokensRenderer
                  collapsableBlock={collapsableBlock}
                  tokens={token.content}
                />
              </h2>
            );
          } else {
            return (
              <h1 className="text-3xl">
                <TokensRenderer
                  collapsableBlock={collapsableBlock}
                  tokens={token.content}
                />
              </h1>
            );
          }
        })();
      case 'inlineCode':
        return (
          <pre
            data-offset-start={token.offsetStart + 1}
            data-offset-end={token.offsetEnd - 1}
            className="content__inline-code"
          >
            {token.content}
          </pre>
        );
      case 'codeBlock':
        const trimmedStart = token.content.replace(/^\n/g, '');

        return (
          <pre
            className="content__code"
            data-offset-start={
              token.offsetStart +
              3 +
              (token.content.length - trimmedStart.length)
            }
            data-offset-end={token.offsetEnd - 3}
          >
            {trimmedStart}
          </pre>
        );
      case 'link':
        return (
          <a
            href={token.href}
            className="link"
            target="_blank"
            rel="noopener noreferrer"
            data-not-editable
            data-offset-start={token.offsetStart}
            data-offset-end={token.offsetEnd}
          >
            {token.content}
          </a>
        );
      case 'str':
        return (
          <span
            data-offset-start={token.offsetStart}
            data-offset-end={token.offsetEnd}
            style={{
              userSelect: 'text',
            }}
          >
            {/** '\n' append is needed to math the behavior of textarea */}

            {token.content}
          </span>
        );
      case 'quote':
        return (
          <blockquote className="quote">
            <TokensRenderer
              collapsableBlock={collapsableBlock}
              tokens={token.content}
            />
          </blockquote>
        );
      case 'textBlockRef':
        return (
          <BlockRefRenderer token={token} collapsableBlock={collapsableBlock} />
        );
      default:
        return <span></span>;
    }
  },
);

export const TokensRenderer = observer(
  ({
    collapsableBlock,
    tokens,
  }: {
    collapsableBlock: CollapsableBlock<TextBlock>;
    tokens: Token[];
  }) => {
    const noteRepo = useNoteBlocksService();

    const linkedNoteIds = useDeepMemo(
      () => [
        ...collapsableBlock.originalBlock.linkedBlockRefs.map((r) => r.id),
      ],
      [[...collapsableBlock.originalBlock.linkedBlockRefs.map((r) => r.id)]],
    );

    const linkedNotes$ = useObservable(
      ($inputs) => {
        return $inputs.pipe(switchMap(([ids]) => noteRepo.findNoteByIds(ids)));
      },
      [linkedNoteIds],
    );
    const linkedNotes = useObservableState(linkedNotes$, []);

    return (
      <>
        {tokens.map((token, i) => (
          <TokenRenderer
            key={`${token.offsetStart}${token.offsetEnd}`}
            collapsableBlock={collapsableBlock}
            token={token}
            linkedNotes={linkedNotes}
          />
        ))}
      </>
    );
  },
);
