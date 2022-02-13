import {
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
import { BlockLink } from './BlockLink';
import { BlockLinkRegistry } from './BlockLinkRegistry';

@model('@harika/BlocksExtension/BlockLinkStore')
export class BlockLinkStore extends Model({
  id: idProp,
  linksRegistry: prop<BlockLinkRegistry>(() => new BlockLinkRegistry({})),
}) {
  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    linksAttrs: ModelData<BlockLink>[],
    deletedLinkIds: SyncModelId<BlockLink>[],
  ) {
    const links: BlockLink[] = [];

    linksAttrs.forEach((linkAttrs) => {
      if (this.linksRegistry.hasBlockWithId(linkAttrs.id!)) {
        links.push(this.linksRegistry.getBlockById(linkAttrs.id!));

        applyModelData(
          this.linksRegistry.getBlockById(linkAttrs.id!),
          linkAttrs,
          (key, oldVal, newVal) => {
            if (key === 'areChildrenLoaded') {
              if (oldVal === true) return true;
            }

            return newVal;
          },
        );
      } else {
        links.push(new BlockLink(linkAttrs));
      }
    });

    deletedLinkIds.forEach((id) => {
      if (this.linksRegistry.hasBlockWithId(id.value)) {
        this.linksRegistry.deleteBlockById(id.value);
      }
    });

    return links;
  }
}
