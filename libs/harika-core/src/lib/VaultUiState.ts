import { model, Model, modelAction, prop } from 'mobx-keystone';

@model('FocusedBlockState')
export class FocusedBlockState extends Model({
  id: prop<string>(),
  startAt: prop<number | undefined>(),
}) {}

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

  getBlockFocusState(viewId: string, blockId: string) {
    const isFocused = this.focusedBlock?.id === `${viewId}-${blockId}`;
    return isFocused
      ? { isFocused: true, startAt: this.focusedBlock?.startAt }
      : { isFocused: false };
  }
}
