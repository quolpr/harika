import { model, Model, modelAction, prop } from 'mobx-keystone';
import { NoteModel, noteRef } from './NoteModel';
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

@model('VaultUiState')
export class VaultUiState extends Model({
  focusedBlock: prop<FocusedBlockState | undefined>(),
  currentNoteId: prop<string | undefined>(),
  blocksViewsMap: prop<Record<string, BlocksViewModel>>(() => ({})),
}) {
  @modelAction
  setCurrentNoteId(id: string | undefined) {
    this.currentNoteId = id;
  }

  @modelAction
  setFocusedBlock(block: FocusedBlockState | undefined) {
    this.focusedBlock = block;
  }

  @modelAction
  getOrCreateViewByModel(
    note: NoteModel,
    model: { $modelId: string; $modelType: string },
  ) {
    const key = `${model.$modelType}-${model.$modelId}`;

    if (this.blocksViewsMap[key]) return this.blocksViewsMap[key];

    this.blocksViewsMap[key] = new BlocksViewModel({
      $modelId: key,
      noteRef: noteRef(note),
    });

    return this.blocksViewsMap[key];
  }

  getBlockFocusState(viewId: string, blockId: string): EditState {
    const isFocused =
      this.focusedBlock?.viewId === viewId &&
      this.focusedBlock?.blockId === blockId;

    return isFocused
      ? {
          isFocused: true,
          startAt: this.focusedBlock?.startAt,
          isEditing: Boolean(this.focusedBlock?.isEditing),
        }
      : { isFocused: false, isEditing: false };
  }
}
