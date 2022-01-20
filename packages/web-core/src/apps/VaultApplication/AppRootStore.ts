import { Model, model, prop } from 'mobx-keystone';
import { Subject } from 'rxjs';
import {
  ISyncableModelChange,
  syncChangesCtx,
} from '../../extensions/SyncExtension/mobx-keystone/syncable';
import { BlocksScopeStore } from './BlocksExtension/models/BlocksScopeStore';
import { BlocksStore } from './BlocksExtension/models/BlocksStore';

@model('harika/VaultAppRootStore')
export class VaultAppRootStore extends Model({
  blocksStore: prop<BlocksStore>(),
  blocksScopeStore: prop<BlocksScopeStore>(),
}) {
  onInit() {
    syncChangesCtx.set(this, new Subject<ISyncableModelChange>());
  }
}
