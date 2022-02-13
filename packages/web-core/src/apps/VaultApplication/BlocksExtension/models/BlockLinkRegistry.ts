import { idProp, Model, model, prop } from 'mobx-keystone';

import { BlockLink } from './BlockLink';

@model('harika/BlocksExtension/BlockLinkRegistry')
export class BlockLinkRegistry extends Model({
  id: idProp,
  blockLinks: prop<Record<string, BlockLink>>(() => ({})),
}) {
  deleteBlockById(id: string) {
    delete this.blockLinks[id];
  }

  getBlockById(id: string) {
    return this.blockLinks[id];
  }

  hasBlockWithId(id: string) {
    return !!this.blockLinks[id];
  }

  registerBlocks(links: BlockLink[]) {
    links.forEach((block) => {
      this.blockLinks[block.$modelId] = block;
    });
  }

  registerBlock(link: BlockLink) {
    this.blockLinks[link.$modelId] = link;
  }
}
