import { inject, injectable } from 'inversify';
import {
  buffer,
  concatMap,
  debounceTime,
  filter,
  Observable,
  takeUntil,
} from 'rxjs';

import {
  IModelChange,
  ModelChangeType,
} from '../../../../extensions/SyncExtension/mobx-keystone/trackChanges';
import { MODELS_CHANGES_PIPE } from '../../../../extensions/SyncExtension/types';
import { STOP_SIGNAL } from '../../../../framework/types';
import { filterAst } from '../../../../lib/blockParser/astHelpers';
import {
  NoteBlockRefToken,
  TagToken,
  TextBlockRef,
} from '../../../../lib/blockParser/types';
import { BlockLinksStore } from '../models/BlockLinkStore';
import { TextBlock } from '../models/TextBlock';
import { BlockLinkService } from './BlockLinkService';
import { NoteBlocksService } from './NoteBlocksService';

@injectable()
export class UpdateLinksService {
  constructor(
    @inject(NoteBlocksService)
    private notesService: NoteBlocksService,
    @inject(BlockLinksStore)
    private linksStore: BlockLinksStore,
    @inject(BlockLinkService)
    private blockLinkService: BlockLinkService,
    @inject(MODELS_CHANGES_PIPE)
    pipe$: Observable<IModelChange>,
    @inject(STOP_SIGNAL)
    stop$: Observable<void>,
  ) {
    const textBlocksChanges$ = pipe$.pipe(
      filter((ch) => ch.model instanceof TextBlock),
    ) as Observable<IModelChange<TextBlock>>;

    textBlocksChanges$
      .pipe(
        buffer(textBlocksChanges$.pipe(debounceTime(100))),
        concatMap(async (changes) => {
          console.debug('Updating block links', changes);

          const createOrUpdatedModels = changes
            .filter(
              (ch) =>
                ch.type === ModelChangeType.Create ||
                ch.type === ModelChangeType.Update,
            )
            .map((ch) => ch.model);
          const deletedModels = changes
            .filter((ch) => ch.type === ModelChangeType.Delete)
            .map((ch) => ch.model);

          await this.updateBlockLinks(createOrUpdatedModels);
          await this.deleteBlockLinks(deletedModels);

          console.debug('Done updating block links', changes);
        }),
        takeUntil(stop$),
      )
      .subscribe();
  }

  async updateBlockLinks(textBlocks: TextBlock[]) {
    // Make sure that all links are loaded
    await this.blockLinkService.loadAllLinksOfBlocks(
      textBlocks.map(({ $modelId }) => $modelId),
    );

    const allTitles = textBlocks.flatMap((block) => {
      return (
        filterAst(
          block.contentModel.ast,
          (t) => t.type === 'noteBlockRef' || t.type === 'tag',
        ) as (NoteBlockRefToken | TagToken)[]
      ).map((t: NoteBlockRefToken | TagToken) => t.ref);
    });

    const existingNotesIndexed = Object.fromEntries(
      (allTitles.length > 0
        ? await this.notesService.getByTitles(allTitles)
        : []
      ).map((n) => [n.title, n]),
    );

    const noteTitleIdMap = Object.fromEntries(
      (
        await Promise.all(
          allTitles.map(async (name) => {
            if (!existingNotesIndexed[name]) {
              const result = await this.notesService.createNote(
                { title: name },
                { isDaily: false },
              );

              if (result.status === 'ok') {
                return result.data;
              } else {
                alert(JSON.stringify(result.errors));
              }
            } else {
              const existing = existingNotesIndexed[name];

              return this.notesService.getNote(existing.$modelId);
            }
          }),
        )
      )
        .flatMap((n) => (n ? [n] : []))
        .map(({ title, $modelId }) => [title, $modelId]),
    );

    textBlocks.forEach((b) => {
      const textBlockIds = (
        filterAst(
          b.contentModel.ast,
          (t) => t.type === 'textBlockRef',
        ) as TextBlockRef[]
      )
        .map((t) => t.blockId)
        .filter((id) => !!id) as string[];

      const noteBlockIds = (
        filterAst(
          b.contentModel.ast,
          (t) => t.type === 'noteBlockRef' || t.type === 'tag',
        ) as (NoteBlockRefToken | TagToken)[]
      )
        .map((t: NoteBlockRefToken | TagToken) => t.ref)
        .map((title) => noteTitleIdMap[title]);

      this.linksStore.updateLinks(
        b.$modelId,
        new Set([...textBlockIds, ...noteBlockIds].filter((id) => !!id)),
      );
    });
  }

  async deleteBlockLinks(textBlocks: TextBlock[]) {
    this.linksStore.deleteLinks(
      (
        await this.blockLinkService.loadAllLinksOfBlocks(
          textBlocks.map((b) => b.$modelId),
        )
      ).map((link) => link.$modelId),
    );
  }
}
