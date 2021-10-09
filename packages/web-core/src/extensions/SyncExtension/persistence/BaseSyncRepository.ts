import 'reflect-metadata';
import { SyncRepository } from './SyncRepository';
import Q from 'sql-bricks';
import { isEqual, mapValues } from 'lodash-es';
import { DB } from '../../DbExtension/DB';
import type { IInternalSyncCtx, ISyncCtx } from './syncCtx';
import { inject, injectable } from 'inversify';
import { WINDOW_ID } from '../../../framework/types';
import { IChangesApplier } from '../serverSynchronizer/ServerSynchronizer';

@injectable()
export abstract class BaseSyncRepository<
  Doc extends Record<string, unknown> & { id: string } = Record<
    string,
    unknown
  > & { id: string },
  Row extends Record<string, unknown> & { id: string } = Record<
    string,
    unknown
  > & { id: string },
> {
  constructor(
    @inject(SyncRepository) protected syncRepository: SyncRepository,
    @inject(DB) protected db: DB<IInternalSyncCtx>,
    @inject(WINDOW_ID) protected windowId: string,
  ) {}

  transaction<T extends any>(func: () => T, ctx?: IInternalSyncCtx): T {
    return this.db.transaction(func, ctx);
  }

  findBy(obj: Partial<Doc>): Doc | undefined {
    const row = this.db.getRecords<Row>(
      Q.select().from(this.getTableName()).where(obj),
    )[0];

    return row ? this.toDoc(row) : undefined;
  }

  getByIds(ids: string[]): Doc[] {
    return this.db
      .getRecords<Row>(
        Q.select().from(this.getTableName()).where(Q.in('id', ids)),
      )
      .map((row) => this.toDoc(row));
  }

  getById(id: string): Doc | undefined {
    return this.findBy({ id } as Partial<Doc>);
  }

  getIsExists(id: string): boolean {
    return this.getById(id) !== undefined;
  }

  getExistingIds(ids: string[]): string[] {
    const [result] = this.db.execQuery(
      Q.select('id').from(this.getTableName()).where(Q.in('id', ids)),
    );

    return (result?.values?.flat() || []) as string[];
  }

  create(attrs: Doc, ctx: ISyncCtx) {
    return this.bulkCreate([attrs], ctx)[0];
  }

  bulkCreateOrUpdate(attrsArray: Doc[], ctx: ISyncCtx) {
    const internalCtx = { ...ctx, windowId: this.windowId };

    return this.db.transaction(() => {
      // TODO: could be optimized
      const existingIds = new Set(
        this.getExistingIds(attrsArray.map(({ id }) => id)),
      );

      const existingRecords: Doc[] = [];
      const notExistingRecords: Doc[] = [];

      attrsArray.forEach((doc) => {
        if (existingIds.has(doc.id)) {
          existingRecords.push(doc);
        } else {
          notExistingRecords.push(doc);
        }
      });

      if (notExistingRecords.length > 0) {
        this.bulkCreate(notExistingRecords, internalCtx);
      }

      if (existingRecords.length > 0) {
        this.bulkUpdate(existingRecords, internalCtx);
      }
    }, internalCtx);
  }

  bulkCreate(attrsArray: Doc[], ctx: ISyncCtx) {
    return this.db.transaction(
      () => {
        this.db.insertRecords(
          this.getTableName(),
          attrsArray.map((attrs) => this.toRow(attrs)),
        );

        this.syncRepository.createCreateChanges(
          this.getTableName(),
          attrsArray,
        );

        return attrsArray;
      },
      { ...ctx, windowId: this.windowId },
    );
  }

  update(changeTo: Doc, ctx: ISyncCtx) {
    return this.bulkUpdate([changeTo], ctx)[0];
  }

  bulkUpdate(records: Doc[], ctx: ISyncCtx) {
    return this.db.transaction(
      () => {
        const prevRecordsMap = Object.fromEntries(
          this.getByIds(records.map(({ id }) => id)).map((prev) => [
            prev.id,
            prev,
          ]),
        );

        const changes = records
          .map((record) => {
            if (!prevRecordsMap[record.id])
              throw new Error(
                `Prev record for ${JSON.stringify(record)} not found!`,
              );

            return { from: prevRecordsMap[record.id], to: record };
          })
          .filter((ch) => {
            return !isEqual(ch.to, ch.from);
          });

        this.db.insertRecords(
          this.getTableName(),
          changes.map(({ to }) => this.toRow(to)),
          true,
        );

        this.syncRepository.createUpdateChanges(this.getTableName(), changes);

        return records;
      },
      { ...ctx, windowId: this.windowId },
    );
  }

  delete(id: string, ctx: ISyncCtx) {
    this.bulkDelete([id], ctx);
  }

  bulkDelete(ids: string[], ctx: ISyncCtx) {
    return this.db.transaction(
      () => {
        const records = this.getByIds(ids);

        this.db.execQuery(
          Q.deleteFrom(this.getTableName()).where(Q.in('id', ids)),
        );

        this.syncRepository.createDeleteChanges(this.getTableName(), records);
      },
      { ...ctx, windowId: this.windowId },
    );
  }

  getAll() {
    return this.db
      .getRecords<Row>(Q.select().from(this.getTableName()))
      .map((row) => this.toDoc(row));
  }

  // TODO: don't call as super. Make nullify() method instead
  toRow(doc: Doc): Row {
    return mapValues(doc, (v) => (v === undefined ? null : v)) as Row;
  }

  toDoc(row: Row): Doc {
    return row as Doc;
  }

  abstract getTableName(): string;
  abstract changesApplier(): IChangesApplier;
}
