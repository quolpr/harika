import { idProp, Model, model, prop } from 'mobx-keystone';
import { Subject } from 'rxjs';

import {
  IModelChange,
  trackChangesPipeCtx,
} from '../../extensions/SyncExtension/mobx-keystone/trackChanges';
import { BlockLinksStore } from './BlocksExtension/models/BlockLinkStore';
import { BlocksScopeStore } from './BlocksExtension/models/BlocksScopeStore';
import { BlocksStore } from './BlocksExtension/models/BlocksStore';

@model('harika/VaultAppRootStore')
export class VaultAppRootStore extends Model({
  id: idProp,
  blocksStore: prop<BlocksStore>(),
  blocksScopeStore: prop<BlocksScopeStore>(),
  blockLinkStore: prop<BlockLinksStore>(),
}) {
  onInit() {
    trackChangesPipeCtx.set(this, new Subject<IModelChange>());
  }
}
