import {
  detach,
  idProp,
  Model,
  model,
  modelAction,
  ModelData,
  prop,
} from 'mobx-keystone';

import { withoutSyncAction } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';
import { applyModelData } from './applyModelData';
import { blockRef } from './BaseBlock';
import { BlockLink } from './BlockLink';
import { BlockLinkRegistry } from './BlockLinkRegistry';

@model('@harika/BlocksExtension/BlockLinksStore')
export class BlockLinksStore extends Model({
  id: idProp,
  linksRegistry: prop<BlockLinkRegistry>(() => new BlockLinkRegistry({})),
}) {
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
            orderPosition: new Date().getUTCSeconds(),
            createdAt: new Date().getUTCSeconds(),
            updatedAt: new Date().getUTCSeconds(),
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

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    linksAttrs: ModelData<BlockLink>[],
    deletedLinkIds: SyncModelId<BlockLink>[],
  ) {
    const links: BlockLink[] = [];

    linksAttrs.forEach((linkAttrs) => {
      if (this.linksRegistry.hasLinkWithId(linkAttrs.id!)) {
        links.push(this.linksRegistry.getLinkById(linkAttrs.id!));

        applyModelData(
          this.linksRegistry.getLinkById(linkAttrs.id!),
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
