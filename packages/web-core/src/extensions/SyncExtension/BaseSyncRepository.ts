import 'reflect-metadata';

import { inject, injectable } from 'inversify';
import { isEqual, mapValues, omit } from 'lodash-es';
import sql, { join, raw } from 'sql-template-tag';

import { WINDOW_ID } from '../../framework/types';
import { DB, IQueryExecuter, Transaction } from '../DbExtension/DB';
import { SyncRepository } from './repositories/SyncRepository';
import type { ISyncCtx } from './syncCtx';

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
    const keyValue = join(
      Object.entries(obj).map(([k, v]) => sql`${raw(k)}=${v}`),
    );

    const row = (
      await e.getRecords<Row>(
        sql`SELECT * FROM ${raw(this.getTableName())} WHERE ${keyValue}`,
      )
    )[0];

    return row ? this.toDoc(row) : undefined;
  }

  async getByIds(ids: string[], e: IQueryExecuter = this.db): Promise<Doc[]> {
    if (ids.length === 0) return [];

    return (
      await e.getRecords<Row>(
        sql`SELECT * FROM ${raw(this.getTableName())} WHERE id IN (${join(
          ids,
        )})`,
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
    if (ids.length === 0) return [];
    const [result] = await e.execQuery(
      sql`SELECT id FROM ${raw(this.getTableName())} WHERE id IN (${join(
        ids,
      )})`,
    );

    return (result?.values?.flat() || []) as string[];
  }

  async create(attrs: Doc, ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return (await this.bulkCreate([attrs], ctx, e))[0];
  }

  async bulkCreateOrUpdate(
    attrsArray: Doc[],
    ctx: ISyncCtx,
    e: IQueryExecuter,
  ) {
    if (attrsArray.length === 0) return;

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
    if (attrsArray.length === 0) return [];

    return e.transaction(async (t) => {
      await t.insertRecords(
        this.getTableName(),
        attrsArray.map((attrs) => this.toRow(attrs)),
      );

      await this.syncRepository.createCreateChanges(
        this.getTableName(),
        attrsArray.map((attr) => omit(attr, this.getIgnoreSyncFields()) as any),
        { ...ctx, windowId: this.windowId },
        t,
      );

      return attrsArray;
    });
  }

  async update(changeTo: Doc, ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return (await this.bulkUpdate([changeTo], ctx, e)).records[0];
  }

  async bulkUpdate(records: Doc[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    if (records.length === 0) return { records: [], touchedRecords: [] };

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

          return {
            from: prevRecordsMap[record.id],

            to: record,
          };
        })
        .filter((ch) => {
          return !isEqual(ch.to, ch.from);
        });

      await t.insertRecords(
        this.getTableName(),
        changes.map(({ to }) => this.toRow(to)),
        true,
      );

      await this.syncRepository.createUpdateChanges(
        this.getTableName(),
        changes.map(({ from, to }) => ({
          from: omit(from, this.getIgnoreSyncFields()) as any,
          to: omit(to, this.getIgnoreSyncFields()) as any,
        })),
        { ...ctx, windowId: this.windowId },
        t,
      );

      const touchedRecords = changes.map((ch) => ch.to);

      return { records, touchedRecords };
    });
  }

  delete(id: string, ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return this.bulkDelete([id], ctx, e);
  }

  async bulkDelete(ids: string[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    if (ids.length === 0) return;

    return e.transaction(async (t) => {
      const records = await this.getByIds(ids, t);

      await t.execQuery(
        sql`DELETE FROM ${raw(this.getTableName())} WHERE id IN (${join(ids)})`,
      );

      await this.syncRepository.createDeleteChanges(
        this.getTableName(),
        records.map((r) => omit(r, this.getIgnoreSyncFields()) as any),
        {
          ...ctx,
          windowId: this.windowId,
        },
        t,
      );
    });
  }

  bulkApplyChanges(
    toCreate: Doc[],
    toUpdate: Doc[],
    toDelete: string[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    return e.transaction(async (t) => {
      await this.bulkCreate(toCreate, ctx, t);
      await this.bulkUpdate(toUpdate, ctx, t);
      await this.bulkDelete(toDelete, ctx, t);
    });
  }

  async getAll(e: IQueryExecuter = this.db) {
    return (
      await e.getRecords<Row>(sql`SELECT * FROM ${raw(this.getTableName())}`)
    ).map((row) => this.toDoc(row));
  }

  // TODO: don't call as super. Make nullify() method instead
  toRow(doc: Doc): Row {
    return mapValues(doc, (v) => (v === undefined ? null : v)) as Row;
  }

  toDoc(row: Row): Doc {
    return row as Doc;
  }

  // TODO: add lock support
  private cachedColumnNames: string[] | undefined;
  async getColumnNames(e: IQueryExecuter = this.db) {
    if (this.cachedColumnNames) return this.cachedColumnNames;

    const res = await e.getRecords<{ name: string }>(
      sql`SELECT name FROM PRAGMA_TABLE_INFO('${raw(this.getTableName())}')`,
    );

    this.cachedColumnNames = res.map(({ name }) => name);

    return this.cachedColumnNames;
  }

  abstract getTableName(): string;

  getIgnoreSyncFields(): (keyof Doc)[] {
    return [];
  }
}
