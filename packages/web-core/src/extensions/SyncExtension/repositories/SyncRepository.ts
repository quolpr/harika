import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import Q from 'sql-bricks';
import { v4 as uuidv4 } from 'uuid';
import { DB, IQueryExecuter, Transaction } from '../../DbExtension/DB';
import { getObjectDiff } from '../serverSynchronizer/utils';
import type { IInternalSyncCtx } from '../syncCtx';
import {
  DocChangeType,
  IAnyDoc,
  IBaseChange,
  ICreateChange,
  IDeleteChange,
  IDocChange,
  IDocSnapshot,
  IUpdateChange,
} from '@harika/sync-common';
import { Overwrite } from 'utility-types';
import { SyncStatusService } from '../services/SyncStatusService';

export const clientChangesTable = 'clientChanges' as const;
export const serverSnapshotsPullsTable = 'serverSnapshotsPulls' as const;
export const serverSnapshotsTable = 'serverSnapshots' as const;

export type WithSourceInfo<T extends IBaseChange> = T & {
  windowId: string;
  source: 'inDomainChanges' | 'inDbChanges';
};

export type IBaseClientChangeRow = {
  id: string;
  docId: string;
  collectionName: string;
  scopeId: string | null;
  timestamp: string;
};

export type ICreateClientChangeRow = IBaseClientChangeRow & {
  type: DocChangeType.Create;
  doc: string;
  changeFrom: null;
  changeTo: null;
};

export type IUpdateClientChangeRow = IBaseClientChangeRow & {
  type: DocChangeType.Update;
  doc: null;
  changeFrom: string;
  changeTo: string;
};

export type IDeleteClientChangeRow = IBaseClientChangeRow & {
  type: DocChangeType.Delete;
  changeFrom: null;
  changeTo: null;
  doc: null;
};

export type IClientChangeRow =
  | ICreateClientChangeRow
  | IUpdateClientChangeRow
  | IDeleteClientChangeRow;

export type IClientChangeDoc = IDocChange;

export type ITransmittedCreateChange = WithSourceInfo<ICreateChange>;
export type ITransmittedUpdateChange = WithSourceInfo<IUpdateChange> & {
  doc: IAnyDoc;
};
export type ITransmittedDeleteChange = WithSourceInfo<IDeleteChange> & {
  doc: IAnyDoc;
};

export type ITransmittedChange =
  | ITransmittedDeleteChange
  | ITransmittedUpdateChange
  | ITransmittedCreateChange;

export type IDocSnapshotRow = Overwrite<
  IDocSnapshot & {
    pullId: string;
    scopeId: string | null;
  },
  {
    doc: string;
    isDeleted: number;
  }
>;

export type ISnapshotsPullsRow = { id: string; serverRevision: number };

// TODO: emit events after transaction finish
@injectable()
export class SyncRepository {
  private onChangeCallback: ((ch: ITransmittedChange[]) => void) | undefined;
  private onNewPullCallback: (() => void) | undefined;

  constructor(
    @inject(DB) private db: DB,
    @inject(SyncStatusService) private syncStatusService: SyncStatusService,
  ) {}

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
    collectionName: string,
    records: (Record<string, unknown> & { id: string })[],
    ctx: IInternalSyncCtx,
    e: IQueryExecuter,
  ) {
    return e.transaction(async (t) => {
      const clocks = await this.syncStatusService.getNextClockBulk(
        records.length,
        t,
      );

      const changeEvents = records.map((data, i): ITransmittedCreateChange => {
        const id = uuidv4();

        return {
          id,
          type: DocChangeType.Create,
          collectionName: collectionName,
          docId: data.id as string,
          doc: data,
          windowId: ctx.windowId,
          source: ctx.source,
          timestamp: clocks[i],
        };
      });

      if (ctx.shouldRecordChange) {
        await t.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): ICreateClientChangeRow => {
            return {
              id: ev.id,
              type: DocChangeType.Create,
              collectionName: collectionName,
              docId: ev.docId,
              doc: JSON.stringify(ev.doc),
              changeFrom: null,
              changeTo: null,
              scopeId: null,
              timestamp: ev.timestamp,
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
    collectionName: string,
    changes: {
      from: Record<string, unknown> & { id: string };
      to: Record<string, unknown> & { id: string };
    }[],
    ctx: IInternalSyncCtx,
    e: IQueryExecuter,
  ) {
    return e.transaction(async (t) => {
      const clocks = await this.syncStatusService.getNextClockBulk(
        changes.length,
        t,
      );

      const changeEvents = changes.map((ch, i): ITransmittedUpdateChange => {
        const id = uuidv4();

        const diff = getObjectDiff(ch.from, ch.to);

        return {
          id,
          type: DocChangeType.Update,
          collectionName,
          doc: ch.to,
          docId: ch.from.id as string,
          from: diff.from,
          to: diff.to,
          windowId: ctx.windowId,
          source: ctx.source,
          timestamp: clocks[i],
        };
      });

      if (ctx.shouldRecordChange) {
        await t.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): IUpdateClientChangeRow => {
            return {
              id: ev.id,
              type: DocChangeType.Update,
              collectionName,
              docId: ev.docId,
              changeFrom: JSON.stringify(ev.from),
              changeTo: JSON.stringify(ev.to),
              doc: null,
              scopeId: null,
              timestamp: ev.timestamp,
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
    collectionName: string,
    objs: (Record<string, unknown> & { id: string })[],
    ctx: IInternalSyncCtx,
    e: IQueryExecuter,
  ) {
    return e.transaction(async (t) => {
      const clocks = await this.syncStatusService.getNextClockBulk(
        objs.length,
        t,
      );

      const changeEvents = objs.map((doc, i): ITransmittedDeleteChange => {
        const id = uuidv4();

        return {
          id,
          type: DocChangeType.Delete,
          collectionName,
          doc,
          docId: doc.id as string,
          windowId: ctx.windowId,
          source: ctx.source,
          timestamp: clocks[i],
        };
      });

      if (ctx.shouldRecordChange) {
        await t.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): IDeleteClientChangeRow => {
            return {
              id: ev.id,
              type: DocChangeType.Delete,
              collectionName,
              docId: ev.docId,
              doc: null,
              changeFrom: null,
              changeTo: null,
              scopeId: null,
              timestamp: ev.timestamp,
            };
          }),
        );
      }

      if (changeEvents.length > 0) {
        this.onChangeCallback?.(changeEvents);
      }
    });
  }

  getChangesPulls(e: IQueryExecuter): Promise<ISnapshotsPullsRow[]> {
    return e.getRecords<ISnapshotsPullsRow>(
      Q.select().from(serverSnapshotsPullsTable),
    );
  }

  async getServerSnapshotsAndClientChangesCount(e: IQueryExecuter = this.db) {
    const [[serverResult], [clientResult]] = await e.execQueries(
      [
        Q.select('COUNT(*)').from(serverSnapshotsTable),
        Q.select('COUNT(*)').from(clientChangesTable),
      ],
      true,
    );

    return [
      serverResult.values[0][0] as number,
      clientResult.values[0][0] as number,
    ];
  }

  async getServerSnapshotsByPullIds(
    pullIds: string[],
    e: IQueryExecuter,
  ): Promise<IDocSnapshot[]> {
    return (
      await e.getRecords<IDocSnapshotRow>(
        Q.select()
          .from(serverSnapshotsTable)
          .where(Q.in('pullId', pullIds))
          .orderBy('rev'),
      )
    ).map((row) => this.snapshotRowToDoc(row));
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
      Q.deleteFrom().from(serverSnapshotsPullsTable).where(Q.in('id', ids)),
    );
  }

  async createPull(
    pull: ISnapshotsPullsRow,
    snapshots: IDocSnapshot[],
    e: IQueryExecuter = this.db,
  ) {
    await e.transaction(async (t) => {
      // TODO: could be optimized in one this.db call

      await t.insertRecords(serverSnapshotsPullsTable, [pull]);

      const rows = snapshots.map((snap): IDocSnapshotRow => {
        return {
          ...snap,
          pullId: pull.id,
          doc: JSON.stringify(snap.doc),
          scopeId: snap.scopeId ? snap.scopeId : null,
          isDeleted: snap.isDeleted ? 1 : 0,
        };
      });

      if (rows.length > 0) {
        await t.insertRecords(serverSnapshotsTable, rows);
      }

      await this.syncStatusService.updateSyncStatus(
        {
          lastReceivedRemoteRevision: pull.serverRevision,
        },
        t,
      );
    });

    this.onNewPullCallback?.();
  }

  private clientChangeRowToDoc(snap: IClientChangeRow): IClientChangeDoc {
    const base = {
      id: snap.id,
      docId: snap.docId,
      collectionName: snap.collectionName,
      timestamp: snap.timestamp,
    };

    if (snap.type === DocChangeType.Create) {
      return {
        ...base,
        type: DocChangeType.Create,
        doc: JSON.parse(snap.doc),
      };
    } else if (snap.type === DocChangeType.Update) {
      return {
        ...base,
        type: DocChangeType.Update,
        from: JSON.parse(snap.changeFrom),
        to: JSON.parse(snap.changeTo),
      };
    } else {
      return {
        ...base,
        type: DocChangeType.Delete,
      };
    }
  }

  private snapshotRowToDoc(snap: IDocSnapshotRow): IDocSnapshot {
    return {
      ...snap,
      doc: JSON.parse(snap.doc),
      isDeleted: Boolean(snap.isDeleted),
    };
  }
}
