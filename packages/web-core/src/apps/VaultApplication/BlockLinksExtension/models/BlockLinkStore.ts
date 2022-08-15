import {
  detach,
  idProp,
  Model,
  model,
  modelAction,
  ModelData,
  prop,
} from 'mobx-keystone';

import { withoutChangeTrackingAction } from '../../../../extensions/SyncExtension/mobx-keystone/trackChanges';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';
import { applyModelData } from '../../BlocksExtension/models/applyModelData';
import { blockRef } from '../../BlocksExtension/models/BaseBlock';
import { BlockLink } from './BlockLink';
import { BlockLinkRegistry } from './BlockLinkRegistry';

@model('@harika/BlocksExtension/BlockLinksStore')
export class BlockLinksStore extends Model({
  id: idProp,
  linksRegistry: prop<BlockLinkRegistry>(() => new BlockLinkRegistry({})),
}) {
  @modelAction
  deleteLinks(ids: string[]) {
    ids.forEach((id) => {
      this.linksRegistry.deleteLinkById(id);
    });
  }

  @modelAction
  updateLinks(currentBlockId: string, linkedBlockIds: Set<string>) {
    const links = this.linksRegistry.getLinksOfBlock(currentBlockId);
    const currentLinkedBlockIds = new Set(
      links.map((l) => l.linkedToBlockRef.id),
    );

    links.forEach((l) => {
      if (!linkedBlockIds.has(l.linkedToBlockRef.id)) {
        detach(l);
      }
    });

    linkedBlockIds.forEach((blockId) => {
      if (!currentLinkedBlockIds.has(blockId)) {
        this.linksRegistry.registerLink(
          new BlockLink({
            blockRef: blockRef(currentBlockId),
            linkedToBlockRef: blockRef(blockId),
            orderPosition: Number.MAX_SAFE_INTEGER - new Date().getTime(),
            createdAt: new Date().getTime(),
            updatedAt: new Date().getTime(),
          }),
        );
      }
    });
  }

  @modelAction
  moveLinks(fromBlockId: string, toBlockId: string) {
    const links = this.linksRegistry.getLinksOfBlock(fromBlockId);

    links.forEach((l) => {
      l.blockRef = blockRef(toBlockId);
    });
  }

  getLinksOfBlock(blockId: string) {
    return this.linksRegistry.getLinksOfBlock(blockId);
  }

  getBacklinksOfBlock(blockId: string) {
    return this.linksRegistry.getBacklinksOfBlock(blockId);
  }

  @withoutUndoAction
  @withoutChangeTrackingAction
  @modelAction
  handleModelChanges(
    linksAttrs: ModelData<BlockLink>[],
    deletedLinkIds: SyncModelId<BlockLink>[],
  ) {
    const links: BlockLink[] = [];

    linksAttrs.forEach((linkAttrs) => {
      if (this.linksRegistry.hasLinkWithId(linkAttrs.id)) {
        links.push(this.linksRegistry.getLinkById(linkAttrs.id));

        applyModelData(
          this.linksRegistry.getLinkById(linkAttrs.id),
          linkAttrs,
          (key, oldVal, newVal) => {
            if (key === 'areChildrenLoaded') {
              if (oldVal === true) return true;
            }

            return newVal;
          },
        );
      } else {
        const newLink = new BlockLink(linkAttrs);
        this.linksRegistry.registerLink(newLink);
        links.push(newLink);
      }
    });

    deletedLinkIds.forEach((id) => {
      if (this.linksRegistry.hasLinkWithId(id.value)) {
        this.linksRegistry.deleteLinkById(id.value);
      }
    });

    return links;
  }
}
