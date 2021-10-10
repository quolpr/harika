import { ScopedBlock } from './ScopedBlock';
import { action, computed, makeObservable, observable } from 'mobx';

export class ScopedBlocksRegistry {
  @observable scopedBlocksMap: Record<string, ScopedBlock> = {};

  constructor() {
    makeObservable(this);
  }

  @computed
  get allBlocks() {
    return Object.values(this.scopedBlocksMap);
  }

  @action
  removeScopedBlock(blockId: string) {
    delete this.scopedBlocksMap[blockId];
  }

  @action
  addScopedBlock(block: ScopedBlock) {
    this.scopedBlocksMap[block.$modelId] = block;
  }

  getScopedBlock = (id: string) => {
    return this.scopedBlocksMap[id];
  };
}
