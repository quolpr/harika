import Q from 'sql-bricks';
import type { Overwrite, Required } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { getCtxStrict } from '../../db/ctx';
import type { DB } from '../../db/DB';
import {
  DatabaseChangeType,
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
} from '../synchronizer/types';
import { getObjectDiff } from '../synchronizer/utils';
import type { IInternalSyncCtx, ISyncCtx } from './syncCtx';

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
export class SyncRepository {
  constructor(
    private db: DB<IInternalSyncCtx>,
    private onChange: (ch: ITransmittedChange[]) => void,
    private onNewPull: () => void,
  ) {}

  transaction<T extends any>(func: () => T, ctx?: IInternalSyncCtx): T {
    return this.db.transaction(func, ctx);
  }

  createCreateChanges(
    table: string,
    records: (Record<string, unknown> & { id: string })[],
  ) {
    this.db.transaction(() => {
      const ctx = getCtxStrict<IInternalSyncCtx>();

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
        this.db.insertRecords(
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

      this.onChange(changeEvents);
    });
  }

  createUpdateChanges(
    table: string,
    changes: {
      from: Record<string, unknown> & { id: string };
      to: Record<string, unknown> & { id: string };
    }[],
  ) {
    this.db.transaction(() => {
      const ctx = getCtxStrict<IInternalSyncCtx>();

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
        this.db.insertRecords(
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

      this.onChange(changeEvents);
    });
  }

  createDeleteChanges(
    table: string,
    objs: (Record<string, unknown> & { id: string })[],
  ) {
    this.db.transaction(() => {
      const ctx = getCtxStrict<IInternalSyncCtx>();

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
        this.db.insertRecords(
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

      this.onChange(changeEvents);
    });
  }

  getChangesPulls(): IChangesPullsRow[] {
    return this.db.getRecords<IChangesPullsRow>(
      Q.select().from(serverChangesPullsTable),
    );
  }

  getServerChangesByPullIds(pullIds: string[]): IServerChangeDoc[] {
    return this.db
      .getRecords<IServerChangeRow>(
        Q.select()
          .from(serverChangesTable)
          .where(Q.in('pullId', pullIds))
          .orderBy('rev'),
      )
      .map((row) => this.serverChangeRowToDoc(row));
  }

  getClientChanges() {
    return this.db
      .getRecords<IClientChangeRow>(
        Q.select().from(clientChangesTable).orderBy('rev'),
      )
      .map((row) => this.clientChangeRowToDoc(row));
  }

  bulkDeleteClientChanges(ids: string[]) {
    this.db.execQuery(
      Q.deleteFrom().from(clientChangesTable).where(Q.in('id', ids)),
    );
  }

  deletePulls(ids: string[]) {
    this.db.execQuery(
      Q.deleteFrom().from(serverChangesPullsTable).where(Q.in('id', ids)),
    );
  }

  createPull(pull: IChangesPullsRow, changes: IServerChangeDoc[]) {
    this.db.transaction(() => {
      this.db.insertRecords(serverChangesPullsTable, [pull]);

      const rows = changes.map((ch): IServerChangeRow => {
        return this.serverChangeDocToRow(ch);
      });

      if (rows.length > 0) {
        this.db.insertRecords(serverChangesTable, rows);
      }

      this.updateSyncStatus({
        lastReceivedRemoteRevision: pull.serverRevision,
      });
    });

    this.onNewPull();
  }

  getSyncStatus(): ISyncStatus {
    let status = this.db.getRecords<ISyncStatus>(
      Q.select().from(syncStatusTable).where({ id: 1 }),
    )[0];

    if (!status) {
      status = {
        id: 1,
        lastReceivedRemoteRevision: null,
        lastAppliedRemoteRevision: null,
        clientId: uuidv4(),
      };

      this.db.insertRecords(syncStatusTable, [status]);
    }

    return status;
  }

  updateSyncStatus(status: Partial<ISyncStatus>) {
    this.db.execQuery(Q.update(syncStatusTable).set(status).where({ id: 1 }));
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
