import { action, comparer, computed, makeObservable, observable } from 'mobx';
import { createContext, useContext } from 'react';

export class BlockFocus {
  @observable public scopeId: string;
  @observable public blockId: string;
  @observable public startAt: number | undefined;

  constructor(scopeId: string, blockId: string, startAt: number | undefined) {
    makeObservable(this);

    this.scopeId = scopeId;
    this.blockId = blockId;
    this.startAt = startAt;
  }
}

export class BlocksFocusState {
  @observable currentFocus: BlockFocus | undefined;
  @observable isEditing = false;

  constructor() {
    makeObservable(this);
  }

  @action
  setIsEditing(isEditing: boolean) {
    this.isEditing = isEditing;
  }

  getCurrentFocus(scopeId: string, blockId: string) {
    return this.currentFocus?.scopeId === scopeId &&
      this.currentFocus?.blockId === blockId
      ? this.currentFocus
      : undefined;
  }

  @action
  changeFocus(
    scopeId: string,
    blockId: string,
    startAt: number | undefined,
    isEditing: boolean,
  ) {
    this.currentFocus = new BlockFocus(scopeId, blockId, startAt);
    this.isEditing = isEditing;
  }

  @action
  resetFocus() {
    this.currentFocus = undefined;
  }
}

export const BlockFocusStateContext = createContext<BlocksFocusState>(
  new BlocksFocusState(),
);

export const useBlockFocusState = () => {
  return useContext(BlockFocusStateContext);
};

export const useCurrentFocus = (scopeId: string, blockId: string) => {
  const state = useBlockFocusState();

  return computed(() => state.getCurrentFocus(scopeId, blockId), {
    equals: comparer.shallow,
  }).get();
};

export const useCurrentIsEditing = (scopeId: string, blockId: string) => {
  const state = useBlockFocusState();
  const currentFocus = useCurrentFocus(scopeId, blockId);

  return Boolean(currentFocus && state.isEditing);
};
