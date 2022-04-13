import { inject, injectable } from 'inversify';

import { AllBlocksService } from '../services/AllBlocksService';

@injectable()
export class DeleteNoteService {
  constructor(
    @inject(AllBlocksService) private blocksService: AllBlocksService,
  ) {}

  async deleteBlock(noteId: string) {
    const block = await this.blocksService.loadBlocksTree(noteId);

    block.delete(true);
  }
}
