import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';
import { BaseBlockDoc, BaseBlockRow } from './AllBlocksRepository';
import { injectable } from 'inversify';

export const blocksLinksTable = 'blocksLinksTable' as const;

@injectable()
export abstract class BaseBlockRepository<
  Doc extends BaseBlockDoc & Record<string, unknown> = BaseBlockDoc &
    Record<string, unknown>,
  Row extends BaseBlockRow & Record<string, unknown> = BaseBlockRow &
    Record<string, unknown>,
> extends BaseSyncRepository<Doc, Row> {
  toRow(doc: Doc): Row {
    const res = {
      ...super.toRow(doc),
      linkedBlockIds: JSON.stringify(doc.linkedBlockIds),
    };

    return res;
  }

  toDoc(row: Row): Doc {
    const res = {
      ...super.toDoc(row),
      linkedBlockIds: JSON.parse(row['linkedBlockIds'] as string),
    };

    return res;
  }
}
