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
  currentNoteId: prop<string | undefined>(),
  blocksViewsMap: prop<Record<string, BlocksViewModel>>(() => ({})),
}) {
  @modelAction
  setCurrentNoteId(id: string | undefined) {
    this.currentNoteId = id;
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
}
