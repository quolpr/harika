import { idProp, Model, model, modelAction, prop } from 'mobx-keystone';
import { Subject } from 'rxjs';

import {
  IModelChange,
  trackChangesPipeCtx,
} from '../../extensions/SyncExtension/mobx-keystone/trackChanges';
import { BlockLinksStore } from './BlockLinksExtension/models/BlockLinkStore';
import { BlocksScopeStore } from './BlockScopesExtension/models/BlocksScopeStore';
import { BlocksStore } from './BlocksExtension/models/BlocksStore';

@model('harika/VaultAppRootStore')
export class VaultAppRootStore extends Model({
  id: idProp,
  blocksStore: prop<BlocksStore>(),
  blocksScopeStore: prop<BlocksScopeStore>(),
  blockLinkStore: prop<BlockLinksStore>(),
}) {
  @modelAction
  setStores(
    blocksStore: BlocksStore,
    blocksScopeStore: BlocksScopeStore,
    blockLinkStore: BlockLinksStore,
  ) {
    this.blocksStore = blocksStore;
    this.blocksScopeStore = blocksScopeStore;
    this.blockLinkStore = blockLinkStore;
  }

  onInit() {
    trackChangesPipeCtx.set(this, new Subject<IModelChange>());
  }
}
