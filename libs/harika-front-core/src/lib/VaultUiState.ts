import { model, Model, modelAction, prop } from 'mobx-keystone';

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
    startAt?: number
  ) {
    return new FocusedBlockState({
      viewId,
      blockId,
      startAt,
      isEditing: Boolean(isEditing),
    });
  }
}

// TODO: move views here
// TODO: maybe big RootState?
@model('VaultUiState')
export class VaultUiState extends Model({
  focusedBlock: prop<FocusedBlockState | undefined>(),
  currentNoteId: prop<string | undefined>(),
}) {
  @modelAction
  setCurrentNoteId(id: string | undefined) {
    this.currentNoteId = id;
  }

  @modelAction
  setFocusedBlock(block: FocusedBlockState | undefined) {
    this.focusedBlock = block;
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
