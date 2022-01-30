import { model, Model, modelAction, prop } from 'mobx-keystone';
import { BaseBlock } from './BaseBlock';

@model('harika/BlocksExtension/BlocksRegistry')
export class BlocksRegistry extends Model({
  blocksMap: prop<Record<string, BaseBlock>>(() => ({})),
  // fromChildToParentMap: prop<Record<string, string>>(() => ({})),
}) {
  getBlockById(id: string) {
    return this.blocksMap[id];
  }

  hasBlockWithId(id: string) {
    return !!this.blocksMap[id];
  }

  registerBlock(block: BaseBlock) {
    this.blocksMap[block.$modelId] = block;
  }

  registerBlocks(blocks: BaseBlock[]) {
    blocks.forEach((block) => {
      this.blocksMap[block.$modelId] = block;
    });
  }

  // // We could use selectors instead, but I am afraid that recalculation
  // // would be too expensive
  // @modelAction
  // updateChildMap(parent: BaseBlock, children: Ref<BaseBlock>[]) {
  //   children.forEach((ch) => {
  //     this.fromChildToParentMap[ch.$modelId] = parent.$modelId;
  //   });
  // }

  // onAttachedToRootStore() {
  //   const dispose = onChildAttachedTo(
  //     () => this.blocksMap,
  //     (block) => {
  //       if (!(block instanceof BaseBlock)) return;

  //       return reaction(
  //         () => block.children,
  //         (children) => {
  //           this.updateChildMap(block, children);
  //         },
  //       );
  //     },
  //   );

  //   return () => dispose(true);
  // }
}
