import { inject, injectable } from 'inversify';
import { uniq } from 'lodash';
import { firstValueFrom } from 'rxjs';
import { filterAst } from '../../../../lib/blockParser/astHelpers';
import {
  NoteBlockRef,
  NoteRefToken,
  TagToken,
} from '../../../../lib/blockParser/types';
import { TextBlock } from '../models/TextBlock';
import { AllBlocksService } from './AllBlocksService';
import { NoteBlocksService } from './NoteBlocksService';

@injectable()
export class UpdateLinksService {
  constructor(
    @inject(AllBlocksService)
    private allBlocksService: AllBlocksService,
    @inject(NoteBlocksService)
    private notesService: NoteBlocksService,
  ) {}

  async updateBlockLinks(noteBlockIds: string[]) {
    console.debug('Updating block links');

    const blocks = await firstValueFrom(
      this.allBlocksService.getBlockByIds$(noteBlockIds),
    );

    const textBlocks = blocks.filter(
      (b) => b instanceof TextBlock,
    ) as TextBlock[];

    const allTitles = textBlocks.flatMap((block) => {
      return (
        filterAst(
          block.contentModel.ast,
          (t) => t.type === 'noteRef' || t.type === 'tag',
        ) as (NoteRefToken | TagToken)[]
      ).map((t: NoteRefToken | TagToken) => t.ref);
    });

    const existingNotesIndexed = Object.fromEntries(
      (allTitles.length > 0
        ? await firstValueFrom(this.notesService.getByTitles$(allTitles))
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
          (t) => t.type === 'noteBlockRef',
        ) as NoteBlockRef[]
      )
        .map((t) => t.blockId)
        .filter((id) => !!id) as string[];

      const noteBlockIds = (
        filterAst(
          b.contentModel.ast,
          (t) => t.type === 'noteRef' || t.type === 'tag',
        ) as (NoteRefToken | TagToken)[]
      )
        .map((t: NoteRefToken | TagToken) => t.ref)
        .map((title) => noteTitleIdMap[title]);

      b.updateLinks(
        uniq([...textBlockIds, ...noteBlockIds].filter((id) => !!id)),
      );
    });
  }
}
