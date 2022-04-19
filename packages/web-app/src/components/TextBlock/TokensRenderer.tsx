import {
  AttachmentTemplateToken,
  BlocksScope,
  BlockView,
  EmbedVideoTemplateToken,
  getBlockView,
  ImageToken,
  NoteBlock,
  NoteRefToken,
  TagToken,
  TextBlock,
  TextBlockRef,
  toggleTodo,
  Token,
} from '@harika/web-core';
import { liveQuery } from 'dexie';
import { isEqual } from 'lodash-es';
import { comparer, computed } from 'mobx';
import { arraySet } from 'mobx-keystone';
import { observer } from 'mobx-react-lite';
import { useObservable, useObservableState } from 'observable-hooks';
import { NumberSize, Resizable } from 're-resizable';
import { Direction } from 're-resizable/lib/resizer';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync, useUnmount } from 'react-use';
import { distinctUntilChanged, from, switchMap, tap } from 'rxjs';

import {
  useHandleNoteClickOrPress,
  useNotePath,
} from '../../contexts/StackedNotesContext';
import {
  useAllBlocksService,
  useBlockLinksStore,
  useUploadService,
} from '../../hooks/vaultAppHooks';
import DownloadIcon from '../../icons/download.svgr.svg?component';

const NoteRefRenderer = observer(
  ({
    token,
    linkedNotes,
    collapsableBlock,
  }: {
    token: NoteRefToken;
    collapsableBlock: BlockView<TextBlock>;
    linkedNotes: NoteBlock[];
  }) => {
    const handleTodoToggle = useCallback(
      (e: React.SyntheticEvent) => {
        e.stopPropagation();

        toggleTodo(
          collapsableBlock.originalBlock,
          collapsableBlock,
          token.id,
        ).map(({ $modelId }) => $modelId);
      },
      [collapsableBlock, token.id],
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
const BlockRefRenderer = observer(({ token }: { token: TextBlockRef }) => {
  const allBlocksService = useAllBlocksService();

  const blockId = token.blockId;
  const blockState = useAsync(
    async () =>
      blockId
        ? (await allBlocksService.getSingleBlockByIds([blockId]))[0]
        : undefined,
    [blockId],
  );

  // TODO maybe pass note id
  const handleClick = useHandleNoteClickOrPress(
    blockState?.value?.$modelId,
    true,
  );
  const handleEnterPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleClick(e);
      }
    },
    [handleClick],
  );

  const fakeScope = useMemo(
    () =>
      new BlocksScope({
        rootBlockId: '123',
        scopeId: '123',
        scopeType: '123',
        collapsedBlockIds: arraySet(),
      }),
    [],
  );

  const collapsableBlock = blockState.value
    ? (getBlockView(fakeScope, blockState.value) as BlockView<TextBlock>)
    : undefined;

  return (
    <span
      className="block-ref"
      onClick={handleClick}
      role="link"
      tabIndex={0}
      data-not-editable
      onKeyPress={handleEnterPress}
      data-offset-start={token.offsetStart}
      data-offset-end={token.offsetEnd}
    >
      {collapsableBlock && (
        <TokensRenderer
          blockView={collapsableBlock}
          tokens={collapsableBlock.originalBlock.contentModel.ast}
        />
      )}
    </span>
  );
});

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

const Resize = React.forwardRef((props, ref) => {
  return (
    <div
      data-not-editable
      ref={ref as any}
      {...props}
      className="resize-container"
    />
  );
});

const useAttachmentUrl = (
  originalUrl: string,
  attachmentId: string | undefined,
) => {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded'>(
    'loading',
  );

  const uploadService = useUploadService();

  useEffect(() => {
    if (attachmentId) {
      const subscription = from(
        liveQuery(() => uploadService.getUpload(attachmentId)),
      )
        .pipe(
          tap((upload) => {
            if (upload) {
              setUrl(URL.createObjectURL(upload.file));
            } else {
              setUrl(undefined);
            }

            setLoadingState('loaded');
          }),
        )
        .subscribe();

      return () => subscription.unsubscribe();
    } else {
      setLoadingState('loaded');
      setUrl(originalUrl);
    }
  }, [attachmentId, originalUrl, uploadService]);

  useUnmount(() => {
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });

  return { url, loadingState };
};

const AttachmentRenderer = ({
  attachment,
}: {
  attachment: AttachmentTemplateToken;
}) => {
  const { url, loadingState } = useAttachmentUrl(
    attachment.content.url,
    attachment.content.attachmentId,
  );

  const handleClick = useCallback(() => {
    if (!url) return;

    const a = document.createElement('a');
    document.body.appendChild(a);
    a.href = url;
    a.download = attachment.content.name;
    a.click();
    a.remove();
  }, [url, attachment]);

  return (
    <button
      data-not-editable
      className="download-attachment-btn"
      onClick={handleClick}
    >
      <DownloadIcon />
      <span className="download-attachment-btn__name">
        {attachment.content.name}
      </span>

      {!url && loadingState === 'loaded' && ' [[NOT FOUND]]'}
    </button>
  );
};

const YoutubeEmbedRenderer = ({
  embedVideo,
}: {
  embedVideo: EmbedVideoTemplateToken;
}) => {
  return (
    <Resizable size={{ width: '100%', height: '500px' }} as={Resize}>
      <iframe
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${embedVideo.content.videoId}`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </Resizable>
  );
};

const ImageRender = ({
  token,
  blockView,
}: {
  token: ImageToken;
  blockView: BlockView<TextBlock>;
}) => {
  const { url, loadingState } = useAttachmentUrl(token.url, token.attachmentId);
  const [width, setWidth] = useState<number | undefined>(token.width);

  const handleResize = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      _direction: Direction,
      elementRef: HTMLElement,
      _delta: NumberSize,
    ) => {
      setWidth(elementRef.clientWidth);
    },
    [],
  );

  const memoSize = useMemo(
    () => ({
      width: width || '100%',
      height: '100%',
    }),
    [width],
  );

  const handleResizeStop = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      _direction: Direction,
      elementRef: HTMLElement,
      _delta: NumberSize,
    ) => {
      setWidth(elementRef.clientWidth);

      blockView.originalBlock.contentModel.changeImageWidth(token.id, width);
    },
    [blockView.originalBlock.contentModel, token.id, width],
  );

  useEffect(() => {
    setWidth(token.width);
  }, [token.width]);

  return (
    <>
      {url ? (
        <Resizable
          size={memoSize}
          onResize={handleResize}
          onResizeStop={handleResizeStop}
          as={Resize}
        >
          <img
            alt={token.title}
            src={url}
            data-offset-start={token.offsetStart}
            data-offset-end={token.offsetEnd}
            data-not-editable
            width="100%"
            height="100%"
            style={{ display: 'inline-block' }}
          />
        </Resizable>
      ) : loadingState === 'loaded' ? (
        <div className="token-error">Error: Image not found</div>
      ) : null}
    </>
  );
};

const TokenRenderer = observer(
  ({
    blockView,
    token,
    linkedNotes,
  }: {
    blockView: BlockView<TextBlock>;
    token: Token;
    linkedNotes: NoteBlock[];
  }) => {
    switch (token.type) {
      case 'tag':
        return <TagRenderer token={token} linkedNotes={linkedNotes} />;
      case 'noteBlockRef':
        return (
          <NoteRefRenderer
            collapsableBlock={blockView}
            token={token}
            linkedNotes={linkedNotes}
          />
        );
      case 'bold':
        return (
          <b>
            <TokensRenderer blockView={blockView} tokens={token.content} />
          </b>
        );
      case 'italic':
        return (
          <i>
            <TokensRenderer blockView={blockView} tokens={token.content} />
          </i>
        );
      case 'highlight':
        return (
          <mark>
            <TokensRenderer blockView={blockView} tokens={token.content} />
          </mark>
        );
      case 'head':
        return (() => {
          if (token.depth === 3) {
            return (
              <h3 className="text-xl">
                <TokensRenderer blockView={blockView} tokens={token.content} />
              </h3>
            );
          } else if (token.depth === 2) {
            return (
              <h2 className="text-2xl">
                <TokensRenderer blockView={blockView} tokens={token.content} />
              </h2>
            );
          } else {
            return (
              <h1 className="text-3xl">
                <TokensRenderer blockView={blockView} tokens={token.content} />
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
            <TokensRenderer blockView={blockView} tokens={token.content} />
          </blockquote>
        );
      case 'textBlockRef':
        return <BlockRefRenderer token={token} />;
      case 'image':
        return <ImageRender blockView={blockView} token={token} />;
      case 'template':
        return token.templateType === 'attachment' ? (
          <AttachmentRenderer attachment={token} />
        ) : token.templateType === 'embed-video' ? (
          <YoutubeEmbedRenderer embedVideo={token} />
        ) : (
          <span />
        );

      default:
        return <span></span>;
    }
  },
);

export const TokensRenderer = observer(
  ({
    blockView,
    tokens,
  }: {
    blockView: BlockView<TextBlock>;
    tokens: Token[];
  }) => {
    const linksStore = useBlockLinksStore();
    const allBlocksService = useAllBlocksService();

    const linkedNoteIds = computed(
      () =>
        linksStore
          .getLinksOfBlock(blockView.$modelId)
          .map(({ linkedToBlockRef }) => linkedToBlockRef.id),
      { equals: comparer.shallow },
    ).get();

    const linkedNotes$ = useObservable(
      ($inputs) => {
        return $inputs.pipe(
          distinctUntilChanged(isEqual),
          switchMap(([ids]) => allBlocksService.getSingleBlockByIds(ids)),
        );
      },
      [linkedNoteIds],
    );
    const linkedNotes = useObservableState(linkedNotes$, []);

    return (
      <>
        {tokens.map((token, i) => (
          <TokenRenderer
            key={i}
            blockView={blockView}
            token={token}
            linkedNotes={linkedNotes as NoteBlock[]}
          />
        ))}
      </>
    );
  },
);
