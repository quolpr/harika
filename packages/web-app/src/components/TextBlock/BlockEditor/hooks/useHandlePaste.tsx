import {
  addTokensToNoteBlock,
  BlocksScope,
  BlockView,
  LinkToken,
  parseStringToTree,
  TextBlock,
} from '@harika/web-core';
import { TextBlockContent } from '@harika/web-core/src/apps/VaultApplication/BlocksExtension/models/TextBlockContentModel';
import { parse } from '@harika/web-core/src/lib/blockParser/blockParser';
import React from 'react';
import { useCallback, useContext } from 'react';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';

import { ShiftPressedContext } from '../../../../contexts/ShiftPressedContext';
import { useBlockFocusState } from '../../../../hooks/useBlockFocusState';
import {
  useBlocksStore,
  useUploadService,
} from '../../../../hooks/vaultAppHooks';
import { insertText } from '../../../../utils';

const getImageSize = (blob: Blob) => {
  return new Promise<{ width: number; height: number } | undefined>(
    (resolve) => {
      let url: string | undefined;

      const revokeUrl = () => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      };

      try {
        let isResolved = false;

        const img = document.createElement('img');
        const url = URL.createObjectURL(blob);
        img.src = url;

        img.onload = () => {
          resolve({ width: img.width, height: img.height });
          revokeUrl();
          isResolved = true;
        };

        setTimeout(() => {
          if (!isResolved) {
            resolve(undefined);
            revokeUrl();
          }
        }, 1000);
      } catch (e) {
        console.error('Failed to get image size');

        revokeUrl();
        resolve(undefined);
      }
    },
  );
};

const EmbedVideoNotificationBody = ({
  closeToast,
  contentModel,
  token,
  embedVideo,
}: {
  closeToast?: () => void;
  contentModel: TextBlockContent;
  token: LinkToken;
  embedVideo: { videoId: string; provider: string };
}) => {
  return (
    <div className="notification">
      <div className="notification__title">Hey! You pasted youtube link</div>

      <div className="notification__body">
        {token.href}
        <br />
        Convert it to embed video?
      </div>

      <div className="notification__btns">
        <button
          onClick={(e) => {
            e.preventDefault();
            closeToast?.();
            contentModel.convertLinkToEmbed(token.href, embedVideo);
          }}
          className="notification__btn notification__btn--yes"
          // Don't trigger blur
          onMouseDown={(e) => e.preventDefault()}
        >
          Yes
        </button>
        <button
          className="notification__btn notification__btn--no"
          onClick={(e) => {
            e.preventDefault();
            closeToast?.();
          }}
          // Don't trigger blur
          onMouseDown={(e) => e.preventDefault()}
        >
          Nope
        </button>
      </div>
    </div>
  );
};

const useHandleFilePaste = (block: BlockView<TextBlock>) => {
  const uploadService = useUploadService();

  return useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>, files: FileList) => {
      e.preventDefault();

      const uploads = Array.from(files).map((f) => ({
        id: uuidv4(),
        file: f,
        attachedToBlockId: block.$modelId,
      }));

      const el = e.currentTarget;
      const toInsert = (
        await Promise.all(
          uploads.map(async (u) => {
            if (u.file.type.startsWith('image/')) {
              const size = await getImageSize(u.file);

              return `![${u.file.name}](harika-file://${u.id} ${
                size ? `=${size.width}x` : ''
              })`;
            } else {
              const attachment = JSON.stringify({
                id: u.id,
                url: `harika-file://${u.id}`,
                name: u.file.name,
              });

              return `{{attachment: |${attachment}|}}`;
            }
          }),
        )
      ).join(' ');

      insertText(el, toInsert);

      await uploadService.createUploads(uploads);
    },
    [block.$modelId, uploadService],
  );
};

const getYoutubeVideoId = (str: string) => {
  return (
    str.match(
      /(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w-]{10,12})\b/,
    )?.[1] || undefined
  );
};

const useHandleTextPaste = (
  block: BlockView<TextBlock>,
  scope: BlocksScope,
) => {
  const blocksStore = useBlocksStore();
  const blockFocusState = useBlockFocusState();

  return useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>, data: string) => {
      if (data.length === 0) return;

      const parsedToTree = parseStringToTree(data);

      if (parsedToTree.length > 0) {
        e.preventDefault();

        const injectedBlocks = addTokensToNoteBlock(
          blocksStore,
          scope,
          block,
          parsedToTree,
        );

        injectedBlocks.map(({ $modelId }) => $modelId);

        if (injectedBlocks[0]) {
          blockFocusState.changeFocus(
            scope.$modelId,
            injectedBlocks[0].$modelId,
            0,
            true,
          );
        }
      } else {
        const tokens = parse(data);

        tokens.forEach((token) => {
          if (token.type !== 'link') return;

          const videoId = getYoutubeVideoId(token.href);

          if (videoId) {
            toast(({ closeToast }) => (
              <EmbedVideoNotificationBody
                closeToast={closeToast}
                contentModel={block.originalBlock.contentModel}
                token={token}
                embedVideo={{ provider: 'youtube', videoId: videoId }}
              />
            ));
          }
        });
      }
    },
    [block, blockFocusState, blocksStore, scope],
  );
};

export const useHandlePaste = (
  block: BlockView<TextBlock>,
  scope: BlocksScope,
  handleCaretChange: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void,
) => {
  const isShiftPressedRef = useContext(ShiftPressedContext);
  const handleFilePaste = useHandleFilePaste(block);
  const handleTextPaste = useHandleTextPaste(block, scope);

  return useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      handleCaretChange(e);

      if (isShiftPressedRef.current) return;

      const data = e.clipboardData.getData('Text');
      const files = e.clipboardData.files;

      if (files.length > 0) {
        await handleFilePaste(e, files);
      } else {
        handleTextPaste(e, data);
      }
    },
    [handleCaretChange, handleFilePaste, handleTextPaste, isShiftPressedRef],
  );
};
