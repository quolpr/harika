import { Model, model, modelAction, prop } from 'mobx-keystone';
import { withoutUndoAction } from '../../../utils';

export interface EditState {
  isFocused: boolean;
  isEditing: boolean;
  startAt?: number;
}

@model('FocusedBlockState')
export class FocusedBlockState extends Model({
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
// That when state is set in `NoteBlocksApp`, then it seems it triggers rerender of all components
// and event in event handler stops bubbling. WTF?
@model('FocusedBlock')
export class FocusedBlock extends Model({
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

  @withoutUndoAction
  @modelAction
  setState(state: FocusedBlockState | undefined) {
    this.state = state;
  }
}
