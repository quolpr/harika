import {
  model,
  Model,
  modelAction,
  ModelCreationData,
  prop,
} from 'mobx-keystone';
import { blocksTreeHolderRef } from './NoteBlockModel';
import type { NoteModel } from './NoteModel';
import { BlocksViewModel } from './VaultUiState/BlocksViewModel';

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
  blocksViewsMap: prop<Record<string, BlocksViewModel>>(() => ({})),
}) {
  getView(note: NoteModel, model: { $modelId: string; $modelType: string }) {
    const key = `${note.$modelId}-${model.$modelType}-${model.$modelId}`;

    if (!this.blocksViewsMap[key]) return undefined;

    return this.blocksViewsMap[key];
  }

  @modelAction
  createViewsByModels(
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

    if (this.blocksViewsMap[key]) return this.blocksViewsMap[key];

    this.blocksViewsMap[key] = new BlocksViewModel({
      $modelId: key,
      blockTreeHolderRef: blocksTreeHolderRef(note.$modelId),
      scopedModelId: model.$modelId,
      scopedModelType: model.$modelType,
    });

    return this.blocksViewsMap[key];
  }

  @modelAction
  createOrUpdateEntitiesFromAttrs(
    blocksViewAttrs: (ModelCreationData<BlocksViewModel> & {
      $modelId: string;
    })[],
  ) {
    blocksViewAttrs.forEach((attr) => {
      if (this.blocksViewsMap[attr.$modelId]) {
        if (
          attr.collapsedBlockIds !== undefined &&
          attr.collapsedBlockIds !== null
        ) {
          this.blocksViewsMap[attr.$modelId].collapsedBlockIds =
            attr.collapsedBlockIds;
        }
      } else {
        this.blocksViewsMap[attr.$modelId] = new BlocksViewModel(attr);
      }
    });
  }
}
