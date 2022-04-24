import {
  getGroupedBacklinks,
  NoteBlock as NoteBlockModel,
} from '@harika/web-core';
import { NoteBlock } from '@harika/web-core';
import { LinkIcon } from '@heroicons/react/solid';
import { isEqual } from 'lodash-es';
import { comparer, computed } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useObservable, useObservableState } from 'observable-hooks';
import React from 'react';
import {
  combineLatest,
  distinctUntilChanged,
  map,
  mapTo,
  of,
  switchMap,
} from 'rxjs';
import tw, { styled } from 'twin.macro';

import {
  useAllBlocksService,
  useBlockLinksService,
  useBlockLinksStore,
  useBlocksScopesService,
  useBlocksScopesStore,
} from '../../hooks/vaultAppHooks';
import { BacklinkedNote } from './BacklinkedNote';

const LinkedReferencesStyled = styled.div`
  ${tw`text-xl text-gray-400 mb-6`}

  display: flex;
  align-items: center;

  margin-top: 30px;
`;

const LinkIconStyled = styled(LinkIcon)`
  ${tw`mr-2`}

  width: 16px;
`;

export const BacklinkedNotes = observer(
  ({ note }: { note: NoteBlockModel }) => {
    const blocksScopesService = useBlocksScopesService();
    const blocksScopesStore = useBlocksScopesStore();
    const blockLinksService = useBlockLinksService();
    const blockLinksStore = useBlockLinksStore();
    const allBlocksService = useAllBlocksService();

    const backlinksLoader$ = useObservable(
      ($inputs) => {
        return $inputs.pipe(
          switchMap(([note]) =>
            blockLinksService
              .loadBacklinkedBlocks$(note.$modelId)
              .pipe(map((noteLinks) => ({ noteLinks, note }))),
          ),
          distinctUntilChanged((a, b) => isEqual(a, b)),
          switchMap(({ noteLinks, note }) => {
            if (noteLinks.rootsIds.length === 0) return of(true);

            return combineLatest([
              allBlocksService.loadBlocksTrees$(noteLinks.rootsIds),
              blocksScopesService.loadOrCreateBlocksScopes(
                noteLinks.links.flatMap((link) => ({
                  scopedBy: note,
                  rootBlockId: link.blockRef.id,
                })),
              ),
              blockLinksService.loadLinksOfBlockDescendants$(
                noteLinks.rootsIds,
              ),
            ]).pipe(mapTo(true));
          }),
        );
      },
      [note],
    );
    const areBacklinksLoaded = useObservableState(backlinksLoader$, false);

    const groupedBacklinks = computed(
      () => getGroupedBacklinks(blockLinksStore, blocksScopesStore, note),
      { equals: comparer.structural },
    ).get();

    return (
      <>
        {areBacklinksLoaded ? (
          <LinkedReferencesStyled className="note__linked-references">
            <LinkIconStyled className="note__link-icon" />
            {groupedBacklinks.count} Linked References
          </LinkedReferencesStyled>
        ) : (
          <LinkedReferencesStyled className="note__linked-references">
            <LinkIconStyled className="note__link-icon" />
            References are loading...
          </LinkedReferencesStyled>
        )}

        {groupedBacklinks.links.map((link) => (
          <BacklinkedNote
            key={link.rootBlock.$modelId}
            note={link.rootBlock as NoteBlock}
            scopesWithBlocks={link.scopesWithBlocks}
          />
        ))}
      </>
    );
  },
);
