import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type {
  RefToken,
  NoteBlockModel,
  Token,
  TagToken,
  NoteModel,
  BlockView,
} from '@harika/web-core';
import { useNotesService } from '../../contexts/CurrentNotesServiceContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { useCurrentNote } from '../../hooks/useCurrentNote';
import { useHandleClick } from '../../hooks/useNoteClick';
import { paths } from '../../paths';
import { useObservable, useObservableState } from 'observable-hooks';
import { map } from 'rxjs';
import { useDeepMemo } from '../../utils';

const RefRenderer = observer(
  ({
    token,
    noteBlock,
    linkedNotes,
  }: {
    token: RefToken;
    noteBlock: BlockView;
    linkedNotes: NoteModel[];
  }) => {
    const location = useLocation();
    const vault = useCurrentVault();
    const noteRepo = useNotesService();
    const currentNote = useCurrentNote();

    const handleTodoToggle = useCallback(
      (e: React.SyntheticEvent) => {
        e.stopPropagation();

        noteRepo.updateNoteBlockLinks(
          noteBlock.toggleTodo(token.id).map(({ $modelId }) => $modelId),
        );
      },
      [noteBlock, noteRepo, token.id],
    );

    const note = linkedNotes.find((n) => {
      return n.title === token.ref;
    });

    const handleClick = useHandleClick(
      vault,
      currentNote?.$modelId,
      note?.$modelId,
    );

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
        to={
          paths.vaultNotePath({
            vaultId: vault.$modelId,
            noteId: note.$modelId,
          }) + location.search
        }
        onClick={handleClick}
        className="link"
        data-not-editable
      >
        {token.alias ? token.alias : token.ref}
      </Link>
    );
  },
);

const TagRenderer = observer(
  ({ token, linkedNotes }: { token: TagToken; linkedNotes: NoteModel[] }) => {
    const location = useLocation();
    const vault = useCurrentVault();
    const currentNote = useCurrentNote();

    const note = linkedNotes.find((n) => {
      return n.title === token.ref;
    });

    const handleClick = useHandleClick(
      vault,
      currentNote?.$modelId,
      note?.$modelId,
    );

    if (!note) return <>#{token.ref}</>;

    return (
      <Link
        to={
          paths.vaultNotePath({
            vaultId: vault.$modelId,
            noteId: note.$modelId,
          }) + location.search
        }
        onClick={handleClick}
        className="link link--darker"
        data-not-editable
      >
        #{token.ref}
      </Link>
    );
  },
);

const TokenRenderer = observer(
  ({
    noteBlock,
    token,
    linkedNotes,
  }: {
    noteBlock: BlockView;
    token: Token;
    linkedNotes: NoteModel[];
  }) => {
    switch (token.type) {
      case 'tag':
        return <TagRenderer token={token} linkedNotes={linkedNotes} />;
      case 'ref':
        return (
          <RefRenderer
            token={token}
            noteBlock={noteBlock}
            linkedNotes={linkedNotes}
          />
        );
      case 'bold':
        return (
          <b>
            <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
          </b>
        );
      case 'italic':
        return (
          <i>
            <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
          </i>
        );
      case 'highlight':
        return (
          <mark>
            <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
          </mark>
        );
      case 'head':
        return (() => {
          if (token.depth === 3) {
            return (
              <h3 className="text-xl">
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
              </h3>
            );
          } else if (token.depth === 2) {
            return (
              <h2 className="text-2xl">
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
              </h2>
            );
          } else {
            return (
              <h1 className="text-3xl">
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
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
        const trimmedStart = token.content.trimStart();

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
            {token.content}
          </span>
        );
      case 'quote':
        return (
          <blockquote className="quote">
            <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
          </blockquote>
        );
      default:
        return <span></span>;
    }
  },
);

export const TokensRenderer = observer(
  ({ noteBlock, tokens }: { noteBlock: BlockView; tokens: Token[] }) => {
    const noteRepo = useNotesService();

    const linkedNoteIds = useDeepMemo(
      () => [...noteBlock.linkedNoteIds],
      [[...noteBlock.linkedNoteIds]],
    );

    const linkedNotes$ = useObservable(
      ($inputs) => {
        return noteRepo.findNoteByIds$($inputs.pipe(map(([ids]) => ids)));
      },
      [linkedNoteIds],
    );
    const linkedNotes = useObservableState(linkedNotes$, []);

    return (
      <>
        {tokens.map((token) => (
          <TokenRenderer
            key={`${token.offsetStart}${token.offsetEnd}`}
            noteBlock={noteBlock}
            token={token}
            linkedNotes={linkedNotes}
          />
        ))}
      </>
    );
  },
);
