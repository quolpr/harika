import { computed } from 'mobx';
import { idProp, Model, model, prop } from 'mobx-keystone';

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

  @computed
  get linksMap() {
    const map: Record<string, BlockLink[]> = {};
    Object.values(this.blockLinks).forEach((link) => {
      if (!map[link.blockRef.id]) map[link.blockRef.id] = [];

      map[link.blockRef.id].push(link);
    });

    return map;
  }

  @computed
  get backlinksMap() {
    const map: Record<string, BlockLink[]> = {};
    Object.values(this.blockLinks).forEach((link) => {
      if (!map[link.linkedToBlockRef.id]) map[link.linkedToBlockRef.id] = [];

      map[link.linkedToBlockRef.id].push(link);
    });

    return map;
  }

  getLinksOfBlock(blockId: string) {
    return this.linksMap[blockId] || [];
  }

  getBacklinksOfBlock(blockId: string) {
    return this.backlinksMap[blockId] || [];
  }
}
