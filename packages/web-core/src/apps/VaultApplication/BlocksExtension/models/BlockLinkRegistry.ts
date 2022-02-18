import {
  getParent,
  getSnapshot,
  idProp,
  Model,
  model,
  prop,
} from 'mobx-keystone';

import { BlockLink } from './BlockLink';

@model('harika/BlocksExtension/BlockLinkRegistry')
export class BlockLinkRegistry extends Model({
  id: idProp,
  blockLinks: prop<Record<string, BlockLink>>(() => ({})),
}) {
  deleteLinkById(id: string) {
    delete this.blockLinks[id];
  }

  getLinkById(id: string) {
    return this.blockLinks[id];
  }

  hasLinkWithId(id: string) {
    return !!this.blockLinks[id];
  }

  registerLinks(links: BlockLink[]) {
    links.forEach((block) => {
      this.blockLinks[block.$modelId] = block;
    });
  }

  registerLink(link: BlockLink) {
    this.blockLinks[link.$modelId] = link;
  }

  // TODO: cache
  getLinksOfBlock(blockId: string) {
    return Object.values(this.blockLinks).filter(
      (b) => b.blockRef.id === blockId,
    );
  }

  // TODO: cache
  getBacklinksOfBlock(blockId: string) {
    return Object.values(this.blockLinks).filter(
      (b) => b.linkedToBlockRef.id === blockId,
    );
  }
}
