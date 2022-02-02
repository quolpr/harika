import { BaseBlock } from '@harika/web-core';
import { comparer, computed, makeObservable, observable } from 'mobx';
import { createContext, useContext } from 'react';

class LinkedBlocksStore {
  @observable linkedBlocks: Record<
    string,
    { rootBlock: BaseBlock; blocks: BaseBlock[] }[]
  > = {};

  constructor() {
    makeObservable(this);
  }

  getLinkedBlocksOf(blockId: string) {
    return this.linkedBlocks[blockId] || [];
  }
}
const LinkedBlocksStoreContext = createContext<undefined | LinkedBlocksStore>(
  undefined,
);

export const useLinkedBlocksStore = () => {
  const store = useContext(LinkedBlocksStoreContext);

  if (!store) throw new Error('Linked blocks store is not initialized');

  return store;
};

export const LoadAllBacklinkedBlocks = ({ block }: { block: BaseBlock }) => {};

export const useLinkedBlocksOf = (blockId: string) => {
  const store = useLinkedBlocksStore();

  return computed(() => store.getLinkedBlocksOf(blockId), {
    equals: comparer.shallow,
  }).get();
};
