import { computed } from 'mobx';
import { model, Model, modelAction, prop } from 'mobx-keystone';
import blockParser from '../../blockParser/blockParser';

@model('harika/ContentManagerModel')
export class BlockContentModel extends Model({
  value: prop<string>(),
}) {
  @computed
  get ast() {
    return blockParser.parse(this.value);
  }

  @modelAction
  update(value: string) {
    this.value = value;
  }

  @modelAction
  updateTitle(title: string, newTitle: string) {
    this.value.split(`[[${title}]]`).join(`[[${newTitle}]]`);
  }
}
