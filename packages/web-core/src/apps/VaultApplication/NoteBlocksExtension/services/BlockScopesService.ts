import { Remote } from 'comlink';
import { injectable, inject } from 'inversify';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { toRemoteName } from '../../../../framework/utils';
import { NoteBlocksExtensionStore } from '../models/NoteBlocksExtensionStore';
import { BlocksScopesRepository } from '../repositories/BlockScopesRepository';

@injectable()
export class BlockScopesService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(toRemoteName(BlocksScopesRepository))
    private blocksScopesRepository: Remote<BlocksScopesRepository>,
    @inject(toRemoteName(NoteBlocksExtensionStore))
    private store: NoteBlocksExtensionStore,
  ) {}
}
