import { inject, injectable } from 'inversify';
import { groupBy } from 'lodash-es';
import {
  buffer,
  concatMap,
  debounceTime,
  filter,
  Observable,
  takeUntil,
} from 'rxjs';
import { v4 } from 'uuid';

import {
  IModelChange,
  ModelChangeType,
} from '../../../../extensions/SyncExtension/mobx-keystone/trackChanges';
import { MODELS_CHANGES_PIPE } from '../../../../extensions/SyncExtension/types';
import { STOP_SIGNAL } from '../../../../framework/types';
import { TextBlock } from '../../BlocksExtension/models/TextBlock';
import {
  AttachmentsBlocksRelationsRepository,
  IAttachmentRelationDoc,
} from '../repositories/AttachmentsBlocksRelationsRepository';

@injectable()
export class RelationUpdaterService {
  constructor(
    @inject(AttachmentsBlocksRelationsRepository)
    private relationsRepo: AttachmentsBlocksRelationsRepository,
    @inject(MODELS_CHANGES_PIPE)
    private pipe$: Observable<IModelChange>,
    @inject(STOP_SIGNAL)
    private stop$: Observable<void>,
  ) {}

  start() {
    const textBlocksChanges$ = this.pipe$.pipe(
      filter((ch) => ch.model instanceof TextBlock),
    ) as Observable<IModelChange<TextBlock>>;

    textBlocksChanges$
      .pipe(
        buffer(textBlocksChanges$.pipe(debounceTime(100))),
        concatMap(async (changes) => {
          const deleteChs = changes.filter(
            (ch) => ch.type === ModelChangeType.Delete,
          );
          const updateOrCreateChs = changes.filter(
            (ch) =>
              ch.type === ModelChangeType.Create ||
              ch.type === ModelChangeType.Update,
          );

          if (deleteChs.length > 0) {
            await this.deleteRelations(deleteChs.map((ch) => ch.model.id));
          }
          if (updateOrCreateChs.length > 0) {
            await this.createOrDeleteRelations(
              updateOrCreateChs.map((ch) => ch.model),
            );
          }
        }),
        takeUntil(this.stop$),
      )
      .subscribe();
  }

  private async createOrDeleteRelations(blocks: TextBlock[]) {
    const syncConfig = {
      shouldRecordChange: true,
      source: 'inDbChanges' as const,
    };

    const toCreateRelations: IAttachmentRelationDoc[] = [];
    const toDeleteRelationIds: string[] = [];

    const relations = await this.relationsRepo.getAttachedTo(
      blocks.map(({ $modelId }) => $modelId),
    );

    const existsRelationsMap = groupBy(relations, 'blockId');

    blocks.forEach((bl) => {
      const existsRelationIds = new Set(
        (existsRelationsMap[bl.$modelId] || []).map((m) => m.attachmentId),
      );
      const newBlockAttachmentIds = new Set(bl.contentModel.attachmentIds);

      newBlockAttachmentIds.forEach((attachmentId) => {
        if (existsRelationIds.has(attachmentId)) return;

        toCreateRelations.push({
          id: v4(),
          blockId: bl.$modelId,
          attachmentId,
          createdAt: new Date().getTime(),
        });
      });

      existsRelationIds.forEach((attachmentId) => {
        if (newBlockAttachmentIds.has(attachmentId)) return;

        toDeleteRelationIds.push(attachmentId);
      });
    });

    if (toCreateRelations.length > 0) {
      await this.relationsRepo.bulkCreate(toCreateRelations, syncConfig);
    }
    if (toDeleteRelationIds.length > 0) {
      await this.relationsRepo.bulkDelete(toDeleteRelationIds, syncConfig);
    }
  }

  private async deleteRelations(blockIds: string[]) {
    const relations = await this.relationsRepo.getAttachedTo(blockIds);

    if (relations.length > 0) {
      await this.relationsRepo.bulkDelete(
        relations.map((r) => r.id),
        {
          shouldRecordChange: true,
          source: 'inDbChanges',
        },
      );
    }
  }
}
