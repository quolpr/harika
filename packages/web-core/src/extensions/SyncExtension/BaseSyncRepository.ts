import 'reflect-metadata';
import { SyncRepository } from './repositories/SyncRepository';
import Q from 'sql-bricks';
import { isEqual, mapValues } from 'lodash-es';
import { DB, IQueryExecuter, Transaction } from '../DbExtension/DB';
import type { ISyncCtx } from './syncCtx';
import { inject, injectable } from 'inversify';
import { WINDOW_ID } from '../../framework/types';
import { IChangesApplier } from './serverSynchronizer/ServerSynchronizer';

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
    @inject(DB) protected db: DB,
    @inject(WINDOW_ID) protected windowId: string,
  ) {}

  async transaction<T extends any>(
    func: (t: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(func);
  }

  async findBy(
    obj: Partial<Doc>,
    e: IQueryExecuter = this.db,
  ): Promise<Doc | undefined> {
    const row = (
      await e.getRecords<Row>(Q.select().from(this.getTableName()).where(obj))
    )[0];

    return row ? this.toDoc(row) : undefined;
  }

  async getByIds(ids: string[], e: IQueryExecuter = this.db): Promise<Doc[]> {
    return (
      await e.getRecords<Row>(
        Q.select().from(this.getTableName()).where(Q.in('id', ids)),
      )
    ).map((row) => this.toDoc(row));
  }

  async getById(
    id: string,
    e: IQueryExecuter = this.db,
  ): Promise<Doc | undefined> {
    return this.findBy({ id } as Partial<Doc>, e);
  }

  async getIsExists(id: string, e: IQueryExecuter): Promise<boolean> {
    return (await this.getById(id, e)) !== undefined;
  }

  async getExistingIds(ids: string[], e: IQueryExecuter): Promise<string[]> {
    const [result] = await e.execQuery(
      Q.select('id').from(this.getTableName()).where(Q.in('id', ids)),
    );

    return (result?.values?.flat() || []) as string[];
  }

  async create(attrs: Doc, ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return (await this.bulkCreate([attrs], ctx, e))[0];
  }

  bulkCreateOrUpdate(attrsArray: Doc[], ctx: ISyncCtx, e: IQueryExecuter) {
    const internalCtx = { ...ctx, windowId: this.windowId };

    return e.transaction(async (t) => {
      // TODO: could be optimized
      const existingIds = new Set(
        await this.getExistingIds(
          attrsArray.map(({ id }) => id),
          t,
        ),
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
        await this.bulkCreate(notExistingRecords, internalCtx, t);
      }

      if (existingRecords.length > 0) {
        await this.bulkUpdate(existingRecords, internalCtx, t);
      }
    });
  }

  async bulkCreate(
    attrsArray: Doc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    return e.transaction(async (t) => {
      await t.insertRecords(
        this.getTableName(),
        attrsArray.map((attrs) => this.toRow(attrs)),
      );

      await this.syncRepository.createCreateChanges(
        this.getTableName(),
        attrsArray,
        { ...ctx, windowId: this.windowId },
        t,
      );

      return attrsArray;
    });
  }

  async update(changeTo: Doc, ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return (await this.bulkUpdate([changeTo], ctx, e))[0];
  }

  bulkUpdate(records: Doc[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return e.transaction(async (t) => {
      const prevRecordsMap = Object.fromEntries(
        (
          await this.getByIds(
            records.map(({ id }) => id),
            t,
          )
        ).map((prev) => [prev.id, prev]),
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

      await t.insertRecords(
        this.getTableName(),
        changes.map(({ to }) => this.toRow(to)),
        true,
      );

      this.syncRepository.createUpdateChanges(
        this.getTableName(),
        changes,
        { ...ctx, windowId: this.windowId },
        t,
      );

      return records;
    });
  }

  delete(id: string, ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return this.bulkDelete([id], ctx, e);
  }

  bulkDelete(ids: string[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return e.transaction(async (t) => {
      const records = await this.getByIds(ids, t);

      await t.execQuery(
        Q.deleteFrom(this.getTableName()).where(Q.in('id', ids)),
      );

      await this.syncRepository.createDeleteChanges(
        this.getTableName(),
        records,
        {
          ...ctx,
          windowId: this.windowId,
        },
        t,
      );
    });
  }

  async getAll(e: IQueryExecuter = this.db) {
    return (await e.getRecords<Row>(Q.select().from(this.getTableName()))).map(
      (row) => this.toDoc(row),
    );
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
