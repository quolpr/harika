import { model, Model, modelAction, prop } from 'mobx-keystone';
import type { ModelCreationData } from 'mobx-keystone';
import type { NoteModel } from './NoteModel';
import { BlocksViewModel } from './VaultUiState/BlocksViewModel';
import { blocksTreeHolderRef } from './BlocksTreeHolder';
import { BlocksUIState } from './BlocksTreeView/BlocksTreeNodeModel';

export interface EditState {
  isFocused: boolean;
  isEditing: boolean;
  startAt?: number;
}

@model('FocusedBlockState')
export class FocusedBlockState extends Model({
  viewId: prop<string>(),
  blockId: prop<string>(),
  startAt: prop<number | undefined>(),
  isEditing: prop<boolean>(),
}) {
  // viewId is required cause block could be rendered multiple times on the page
  static create(
    viewId: string,
    blockId: string,
    isEditing?: boolean,
    startAt?: number,
  ) {
    return new FocusedBlockState({
      viewId,
      blockId,
      startAt,
      isEditing: Boolean(isEditing),
    });
  }
}

// React/mobx has weird bug(and I am not sure that issue exists in github?)
// That when state is set in `ui`, then it seems it triggers rerender of all components
// and event in event handler stops bubbling. WTF?
// Thats why we need to decouple FocusedBlockState from VaultUiState storing
@model('FocusedBlock')
export class FocusedBlock extends Model({
  state: prop<FocusedBlockState | undefined>(),
}) {
  getFocusState(viewId: string, blockId: string): EditState {
    const isFocused =
      this.state?.viewId === viewId && this.state?.blockId === blockId;

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

@model('VaultUiState')
export class VaultUiState extends Model({
  focusedBlock: prop<FocusedBlock>(() => new FocusedBlock({})),
  blocksUiStateMap: prop<Record<string, BlocksUIState>>(() => ({})),
}) {
  getBlockState(
    note: NoteModel,
    model: { $modelId: string; $modelType: string },
  ) {
    const key = `${note.$modelId}-${model.$modelType}-${model.$modelId}`;

    if (!this.blocksUiStateMap[key]) return undefined;

    return this.blocksUiStateMap[key];
  }

  @modelAction
  createBlockStateByModels(
    note: NoteModel,
    models: { $modelId: string; $modelType: string }[],
  ) {
    models.map((model) => this.createViewByModel(note, model));
  }

  @modelAction
  createViewByModel(
    note: NoteModel,
    model: { $modelId: string; $modelType: string },
  ) {
    const key = `${note.$modelId}-${model.$modelType}-${model.$modelId}`;

    if (this.blocksUiStateMap[key]) return this.blocksUiStateMap[key];

    this.blocksUiStateMap[key] = new BlocksUIState({
      $modelId: key,
      scopedModelId: model.$modelId,
      scopedModelType: model.$modelType,
    });

    return this.blocksUiStateMap[key];
  }

  @modelAction
  createOrUpdateEntitiesFromAttrs(
    blocksViewAttrs: (ModelCreationData<BlocksViewModel> & {
      $modelId: string;
    })[],
  ) {
    blocksViewAttrs.forEach((attr) => {
      if (this.blocksUiStateMap[attr.$modelId]) {
        if (
          attr.collapsedBlockIds !== undefined &&
          attr.collapsedBlockIds !== null
        ) {
          this.blocksUiStateMap[attr.$modelId].collapsedBlockIds =
            attr.collapsedBlockIds;
        }
      } else {
        this.blocksUiStateMap[attr.$modelId] = new BlocksViewModel(attr);
      }
    });
  }
}
