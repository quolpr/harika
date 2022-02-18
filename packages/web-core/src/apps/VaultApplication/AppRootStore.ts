import { idProp, Model, model, prop } from 'mobx-keystone';
import { Subject } from 'rxjs';

import {
  ISyncableModelChange,
  syncChangesCtx,
} from '../../extensions/SyncExtension/mobx-keystone/syncable';
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
    syncChangesCtx.set(this, new Subject<ISyncableModelChange>());
  }
}
