import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import Q from 'sql-bricks';
import type { Overwrite, Required } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { DB, IQueryExecuter, Transaction } from '../../../DbExtension/DB';
import type {
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
} from '../../app/serverSynchronizer/types';
import { DatabaseChangeType } from '../../app/serverSynchronizer/types';
import { getObjectDiff } from '../../app/serverSynchronizer/utils';
import type { IInternalSyncCtx, ISyncCtx } from '../syncCtx';

export const clientChangesTable = 'clientChanges' as const;
export const syncStatusTable = 'syncStatus' as const;
export const serverChangesPullsTable = 'serverChangesPulls' as const;
export const serverChangesTable = 'serverChanges' as const;

type IChangeExtended = {
  windowId: string;
  source: 'inDomainChanges' | 'inDbChanges';
};

export type IBaseClientChangeRow = {
  id: string;
  key: string;
  obj: string;
  inTable: string;
  rev: number;
};

export type ICreateClientChangeRow = IBaseClientChangeRow & {
  type: DatabaseChangeType.Create;
  changeFrom: null;
  changeTo: null;
};

export type IUpdateClientChangeRow = IBaseClientChangeRow & {
  type: DatabaseChangeType.Update;
  changeFrom: string;
  changeTo: string;
};

export type IDeleteClientChangeRow = IBaseClientChangeRow & {
  type: DatabaseChangeType.Delete;
  changeFrom: null;
  changeTo: null;
};

export type IClientChangeRow =
  | ICreateClientChangeRow
  | IUpdateClientChangeRow
  | IDeleteClientChangeRow;

export type ICreateClientChangeDoc = ICreateChange & { rev: number };
export type IUpdateClientChangeDoc = Required<IUpdateChange, 'obj'> & {
  rev: number;
};
export type IDeleteClientChangeDoc = IDeleteChange & { rev: number };

export type IClientChangeDoc =
  | ICreateClientChangeDoc
  | IUpdateClientChangeDoc
  | IDeleteClientChangeDoc;

export type ITransmittedCreateChange = ICreateChange & IChangeExtended;
export type ITransmittedUpdateChange = IUpdateChange & IChangeExtended;
export type ITransmittedDeleteChange = IDeleteChange & IChangeExtended;

export type ITransmittedChange =
  | ITransmittedDeleteChange
  | ITransmittedUpdateChange
  | ITransmittedCreateChange;

export type ICreateServerChangeRow = ICreateClientChangeRow;
export type IUpdateServerChangeRow = Overwrite<
  IUpdateClientChangeRow,
  { obj: null }
>;
export type IDeleteServerChangeRow = IDeleteClientChangeRow;

export type IServerChangeRow = (
  | ICreateServerChangeRow
  | IUpdateServerChangeRow
  | IDeleteServerChangeRow
) & {
  pullId: string;
  rev: number;
};
export type IServerChangeDoc = (
  | ICreateChange
  | Omit<IUpdateChange, 'obj'>
  | IDeleteChange
) & {
  pullId: string;
  rev: number;
};
export type IChangesPullsRow = { id: string; serverRevision: number };

export interface ISyncStatus {
  id: 1;
  lastReceivedRemoteRevision: number | null;
  lastAppliedRemoteRevision: number | null;
  clientId: string;
}

// TODO: emit events after transaction finish
@injectable()
export class SyncRepository {
  private onChangeCallback: ((ch: ITransmittedChange[]) => void) | undefined;
  private onNewPullCallback: (() => void) | undefined;

  constructor(@inject(DB) private db: DB) {}

  onChange(callback: (ch: ITransmittedChange[]) => void) {
    this.onChangeCallback = callback;
  }

  onNewPull(callback: () => void) {
    this.onNewPullCallback = callback;
  }

  async transaction<T extends any>(
    func: (t: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(func);
  }

  async createCreateChanges(
    table: string,
    records: (Record<string, unknown> & { id: string })[],
    ctx: IInternalSyncCtx,
    e: IQueryExecuter,
  ) {
    return e.transaction(async (t) => {
      const changeEvents = records.map((data): ITransmittedCreateChange => {
        const id = uuidv4();

        return {
          id,
          type: DatabaseChangeType.Create,
          table,
          key: data.id as string,
          obj: data,
          windowId: ctx.windowId,
          source: ctx.source,
        };
      });

      if (ctx.shouldRecordChange) {
        await t.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): ICreateClientChangeRow => {
            return {
              id: ev.id,
              type: DatabaseChangeType.Create,
              inTable: table,
              key: ev.key,
              obj: JSON.stringify(ev.obj),
              rev: 0,
              changeFrom: null,
              changeTo: null,
            };
          }),
        );
      }

      if (changeEvents.length > 0) {
        this.onChangeCallback?.(changeEvents);
      }
    });
  }

  async createUpdateChanges(
    table: string,
    changes: {
      from: Record<string, unknown> & { id: string };
      to: Record<string, unknown> & { id: string };
    }[],
    ctx: IInternalSyncCtx,
    e: IQueryExecuter,
  ) {
    return e.transaction(async (t) => {
      const changeEvents = changes.map((ch): ITransmittedUpdateChange => {
        const id = uuidv4();

        const diff = getObjectDiff(ch.from, ch.to);

        return {
          id,
          type: DatabaseChangeType.Update,
          table,
          key: ch.from.id as string,
          obj: ch.to,
          from: diff.from,
          to: diff.to,
          windowId: ctx.windowId,
          source: ctx.source,
        };
      });

      if (ctx.shouldRecordChange) {
        await t.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): IUpdateClientChangeRow => {
            return {
              id: ev.id,
              type: DatabaseChangeType.Update,
              inTable: table,
              key: ev.key,
              changeFrom: JSON.stringify(ev.from),
              changeTo: JSON.stringify(ev.to),
              obj: JSON.stringify(ev.obj),
              rev: 0,
            };
          }),
        );
      }

      if (changeEvents.length > 0) {
        this.onChangeCallback?.(changeEvents);
      }
    });
  }

  async createDeleteChanges(
    table: string,
    objs: (Record<string, unknown> & { id: string })[],
    ctx: IInternalSyncCtx,
    e: IQueryExecuter,
  ) {
    return e.transaction(async (t) => {
      const changeEvents = objs.map((obj): ITransmittedDeleteChange => {
        const id = uuidv4();

        return {
          id,
          type: DatabaseChangeType.Delete,
          table,
          key: obj.id as string,
          obj,
          windowId: ctx.windowId,
          source: ctx.source,
        };
      });

      if (ctx.shouldRecordChange) {
        await t.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): IDeleteClientChangeRow => {
            return {
              id: ev.id,
              type: DatabaseChangeType.Delete,
              inTable: table,
              key: ev.key,
              obj: JSON.stringify(ev.obj),
              rev: 0,
              changeFrom: null,
              changeTo: null,
            };
          }),
        );
      }

      if (changeEvents.length > 0) {
        this.onChangeCallback?.(changeEvents);
      }
    });
  }

  getChangesPulls(e: IQueryExecuter): Promise<IChangesPullsRow[]> {
    return e.getRecords<IChangesPullsRow>(
      Q.select().from(serverChangesPullsTable),
    );
  }

  async getServerAndClientChangesCount(e: IQueryExecuter = this.db) {
    const [[serverResult], [clientResult]] = await e.execQueries([
      Q.select('COUNT(*)').from(serverChangesTable),
      Q.select('COUNT(*)').from(clientChangesTable),
    ]);

    return [
      serverResult.values[0][0] as number,
      clientResult.values[0][0] as number,
    ];
  }

  async getServerChangesByPullIds(
    pullIds: string[],
    e: IQueryExecuter,
  ): Promise<IServerChangeDoc[]> {
    return (
      await e.getRecords<IServerChangeRow>(
        Q.select()
          .from(serverChangesTable)
          .where(Q.in('pullId', pullIds))
          .orderBy('rev'),
      )
    ).map((row) => this.serverChangeRowToDoc(row));
  }

  async getClientChanges(e: IQueryExecuter = this.db) {
    return (
      await e.getRecords<IClientChangeRow>(
        Q.select().from(clientChangesTable).orderBy('rev'),
      )
    ).map((row) => this.clientChangeRowToDoc(row));
  }

  async bulkDeleteClientChanges(ids: string[], e: IQueryExecuter = this.db) {
    await e.execQuery(
      Q.deleteFrom().from(clientChangesTable).where(Q.in('id', ids)),
    );
  }

  async deletePulls(ids: string[], e: IQueryExecuter) {
    await e.execQuery(
      Q.deleteFrom().from(serverChangesPullsTable).where(Q.in('id', ids)),
    );
  }

  async createPull(
    pull: IChangesPullsRow,
    changes: IServerChangeDoc[],
    e: IQueryExecuter = this.db,
  ) {
    await e.transaction(async (t) => {
      // TODO: could be optimized in one this.db call

      await t.insertRecords(serverChangesPullsTable, [pull]);

      const rows = changes.map((ch): IServerChangeRow => {
        return this.serverChangeDocToRow(ch);
      });

      if (rows.length > 0) {
        await t.insertRecords(serverChangesTable, rows);
      }

      await this.updateSyncStatus(
        {
          lastReceivedRemoteRevision: pull.serverRevision,
        },
        t,
      );
    });

    this.onNewPullCallback?.();
  }

  async getSyncStatus(e: IQueryExecuter = this.db): Promise<ISyncStatus> {
    let status = (
      await e.getRecords<ISyncStatus>(
        Q.select().from(syncStatusTable).where({ id: 1 }),
      )
    )[0];

    if (!status) {
      status = {
        id: 1,
        lastReceivedRemoteRevision: null,
        lastAppliedRemoteRevision: null,
        clientId: uuidv4(),
      };

      e.insertRecords(syncStatusTable, [status]);
    }

    return status;
  }

  updateSyncStatus(status: Partial<ISyncStatus>, e: IQueryExecuter) {
    return e.execQuery(Q.update(syncStatusTable).set(status).where({ id: 1 }));
  }

  private clientChangeRowToDoc(ch: IClientChangeRow): IClientChangeDoc {
    const base = {
      id: ch.id,
      key: ch.key,
      table: ch.inTable,
      rev: ch.rev,
    };

    if (ch.type === DatabaseChangeType.Create) {
      return {
        ...base,
        type: DatabaseChangeType.Create,
        obj: JSON.parse(ch.obj),
      };
    } else if (ch.type === DatabaseChangeType.Update) {
      return {
        ...base,
        type: DatabaseChangeType.Update,
        obj: JSON.parse(ch.obj),
        from: JSON.parse(ch.changeFrom),
        to: JSON.parse(ch.changeTo),
      };
    } else {
      return {
        ...base,
        type: DatabaseChangeType.Delete,
        obj: JSON.parse(ch.obj),
      };
    }
  }

  private serverChangeRowToDoc(ch: IServerChangeRow): IServerChangeDoc {
    const base = {
      id: ch.id,
      key: ch.key,
      table: ch.inTable,
      pullId: ch.pullId,
      rev: ch.rev,
    };

    if (ch.type === DatabaseChangeType.Create) {
      return {
        ...base,
        type: DatabaseChangeType.Create,
        obj: JSON.parse(ch.obj),
      };
    } else if (ch.type === DatabaseChangeType.Update) {
      return {
        ...base,
        type: DatabaseChangeType.Update,
        from: JSON.parse(ch.changeFrom),
        to: JSON.parse(ch.changeTo),
      };
    } else {
      return {
        ...base,
        type: DatabaseChangeType.Delete,
        obj: JSON.parse(ch.obj),
      };
    }
  }

  private serverChangeDocToRow(ch: IServerChangeDoc): IServerChangeRow {
    const base = {
      id: ch.id,
      key: ch.key,
      inTable: ch.table,
      pullId: ch.pullId,
      rev: ch.rev,
    };

    if (ch.type === DatabaseChangeType.Create) {
      return {
        ...base,
        type: DatabaseChangeType.Create,
        obj: JSON.stringify(ch.obj),
        changeFrom: null,
        changeTo: null,
      };
    } else if (ch.type === DatabaseChangeType.Update) {
      return {
        ...base,
        type: DatabaseChangeType.Update,
        changeFrom: JSON.stringify(ch.from),
        changeTo: JSON.stringify(ch.to),
        obj: null,
      };
    } else {
      return {
        ...base,
        type: DatabaseChangeType.Delete,
        obj: JSON.stringify(ch.obj),
        changeFrom: null,
        changeTo: null,
      };
    }
  }
}
