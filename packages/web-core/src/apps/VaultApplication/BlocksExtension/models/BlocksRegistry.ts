import { has, observable, reaction } from 'mobx';
import { idProp, Model, model, onChildAttachedTo, prop } from 'mobx-keystone';

import { BaseBlock } from './BaseBlock';

@model('harika/BlocksExtension/BlocksRegistry')
export class BlocksRegistry extends Model({
  id: idProp,
  blocksMap: prop<Record<string, BaseBlock>>(() => ({})),
}) {
  @observable
  private childrenOfParentsMap: Record<string, string[]> = {};

  getChildrenOfParent(parentId: string) {
    return (this.childrenOfParentsMap[parentId] || [])
      .map((id) => this.blocksMap[id])
      .sort((a, b) => a.orderPosition - b.orderPosition);
  }

  getBlockById(id: string) {
    return this.blocksMap[id];
  }

  hasBlockWithId(id: string) {
    return has(this.blocksMap, id);
  }

  registerBlock(block: BaseBlock) {
    this.blocksMap[block.$modelId] = block;
  }

  registerBlocks(blocks: BaseBlock[]) {
    blocks.forEach((block) => {
      this.blocksMap[block.$modelId] = block;
    });
  }

  onAttachedToRootStore() {
    const updateRelations = (
      blockId: string,
      currentParentId: string | undefined,
      prevParentId: string | undefined,
    ) => {
      if (prevParentId && this.childrenOfParentsMap[prevParentId]) {
        this.childrenOfParentsMap[prevParentId] = this.childrenOfParentsMap[
          prevParentId
        ].filter((id) => id !== blockId);
      }

      if (!currentParentId) return;

      if (this.childrenOfParentsMap[currentParentId] === undefined) {
        this.childrenOfParentsMap[currentParentId] = [];
      }

      this.childrenOfParentsMap[currentParentId].push(blockId);
    };

    const detach = onChildAttachedTo(
      () => this.blocksMap,
      (b: object) => {
        if (!(b instanceof BaseBlock)) return;

        updateRelations(b.$modelId, b.parentRef?.id, undefined);

        let prevParentId = b.parentRef?.id;

        const dispose = reaction(
          () => b.parentRef,
          (ref) => {
            updateRelations(
              b.$modelId,
              ref?.maybeCurrent?.$modelId,
              prevParentId,
            );

            prevParentId = ref?.id;
          },
        );

        return () => {
          updateRelations(b.$modelId, undefined, prevParentId);

          dispose();
        };
      },
    );

    return () => {
      detach(true);
    };
  }
}
