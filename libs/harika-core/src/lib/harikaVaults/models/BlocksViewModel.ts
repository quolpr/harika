import { model, Model, modelAction, prop } from 'mobx-keystone';

@model('harika/BlocksViewModel')
export class BlocksViewModel extends Model({
  expandedIds: prop<Record<string, boolean>>(() => ({})),
}) {
  @modelAction
  isExpanded(noteBlockId: string) {
    if (this.expandedIds[noteBlockId] !== undefined)
      return this.expandedIds[noteBlockId];

    return true;
  }

  @modelAction
  toggleExpand(noteBlockId: string) {
    if (this.expandedIds[noteBlockId] !== undefined) {
      this.expandedIds[noteBlockId] = !this.expandedIds[noteBlockId];
    } else {
      this.expandedIds[noteBlockId] = false;
    }
  }
}
