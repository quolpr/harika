import { injectable } from 'inversify';

import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';
import { BaseBlockDoc, BaseBlockRow } from './AllBlocksRepository';

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
      parentId: doc.parentId ? doc.parentId : null,
    };

    return res;
  }

  toDoc(row: Row): Doc {
    const res = {
      ...super.toDoc(row),
      parentId: row.parentId ? row.parentId : undefined,
    };

    return res;
  }

  abstract get docType(): string;
}
