import { comparer, computed } from 'mobx';
import { createContext, useCallback, useContext } from 'react';
import { isEqual } from 'lodash-es';
import { idProp, Model, model, modelAction, prop } from 'mobx-keystone';

// TODO: use jsut mobx

export interface EditState {
  isFocused: boolean;
  isEditing: boolean;
  startAt?: number;
}

@model('FocusedBlockState')
export class FocusedBlockState extends Model({
  id: idProp,
  scopeId: prop<string>(),
  scopedBlockId: prop<string>(),
  startAt: prop<number | undefined>(),
  isEditing: prop<boolean>(),
}) {
  // scopeId is required cause block could be rendered multiple times on the page
  static create(
    scopeId: string,
    scopedBlockId: string,
    isEditing?: boolean,
    startAt?: number,
  ) {
    return new FocusedBlockState({
      scopeId,
      scopedBlockId: scopedBlockId,
      startAt,
      isEditing: Boolean(isEditing),
    });
  }
}

// React/mobx has weird bug(and I am not sure that issue exists in github?)
// That when state is set in `NoteBlocksExtensionStore`, then it seems it triggers rerender of all components
// and event in event handler stops bubbling. WTF?
@model('FocusedBlock')
export class FocusedBlock extends Model({
  id: idProp,
  state: prop<FocusedBlockState | undefined>(),
}) {
  getFocusState(scopeId: string, scopeBlockId: string): EditState {
    const isFocused =
      this.state?.scopeId === scopeId &&
      this.state?.scopedBlockId === scopeBlockId;

    return isFocused
      ? {
          isFocused: true,
          startAt: this.state?.startAt,
          isEditing: Boolean(this.state?.isEditing),
        }
      : { isFocused: false, isEditing: false };
  }

  @modelAction
  setState(state: FocusedBlockState | undefined) {
    this.state = state;
  }
}

export const FocusedBlockContext = createContext<FocusedBlock>(
  new FocusedBlock({}),
);

export const useFocusedBlock = () => {
  return useContext(FocusedBlockContext);
};

export const useCurrentFocusedBlockState = (
  scopeId: string,
  scopedBlockId: string,
): [
  EditState,
  (
    block:
      | {
          scopeId: string;
          scopedBlockId: string;
          startAt?: number;
          isEditing?: boolean;
        }
      | undefined,
  ) => void,
] => {
  const focusedBlock = useContext(FocusedBlockContext);

  const focusState = computed(
    () => focusedBlock.getFocusState(scopeId, scopedBlockId),
    { equals: comparer.shallow },
  ).get();

  const setState = useCallback(
    (
      block:
        | {
            scopeId: string;
            scopedBlockId: string;
            isEditing?: boolean;
            startAt?: number;
          }
        | undefined,
    ) => {
      if (block) {
        if (isEqual(focusedBlock.state, block)) return;

        focusedBlock.setState(
          FocusedBlockState.create(
            block.scopeId,
            block.scopedBlockId,
            block.isEditing,
            block.startAt,
          ),
        );
      } else {
        focusedBlock.setState(undefined);
      }
    },
    [focusedBlock],
  );

  return [focusState, setState];
};
