import { inject, injectable } from 'inversify';

import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { BlocksStore } from '../models/BlocksStore';
import { TextBlocksRepository } from '../repositories/TextBlocksRepository';
import { AllBlocksService } from './AllBlocksService';

@injectable()
export class TextBlocksService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(TextBlocksRepository)
    private textBlocksRepository: TextBlocksRepository,
    @inject(BlocksStore)
    private store: BlocksStore,
    @inject(AllBlocksService)
    private allBlocksService: AllBlocksService,
  ) {}
}
