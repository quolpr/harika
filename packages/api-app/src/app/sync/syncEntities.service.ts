import { set } from 'lodash';
import type { Connection, EntityManager, Repository } from 'typeorm';
import type {
  EntityChangeSchema,
  EntitySchema,
  SyncEntitiesService,
} from './types';
import {
  IDatabaseChange,
  IUpdateChange,
  DatabaseChangeType,
} from '@harika/core';

export abstract class BaseSyncEntitiesService implements SyncEntitiesService {
  constructor(
    private connection: Connection,
    private vaultEntitiesRepo: Repository<EntitySchema>,
    private entityChangesRepo: Repository<EntityChangeSchema>,
  ) {}

  async getChangesFromRev(
    scopeId: string,
    ownerId: string,
    rev: number,
    clientIdentity: string,
  ): Promise<{ changes: IDatabaseChange[]; lastRev: number }> {
    const changes = await this.entityChangesRepo
      .createQueryBuilder('changes')
      .where('changes.source <> :clientIdentity', { clientIdentity })
      .andWhere('changes.rev > :rev', { rev })
      .andWhere('changes.scopeId = :scopeId', { scopeId })
      .andWhere('changes.ownerId = :ownerId', { ownerId })
      .orderBy('changes.rev', 'ASC')
      .getMany();

    // Todo: merge to query above, race condition may happen
    const lastRev = (
      await this.entityChangesRepo
        .createQueryBuilder('changes')
        .select(['MAX(changes.rev)'])
        .where('changes.scopeId = :scopeId', { scopeId })
        .andWhere('changes.ownerId = :ownerId', { ownerId })
        .getRawOne()
    ).max as number;

    return {
      changes: changes.map((ch) => ch.toChange()),
      lastRev: lastRev !== undefined && lastRev !== null ? lastRev : 0,
    };
  }

  async applyChanges(
    changes: IDatabaseChange[],
    scopeId: string,
    ownerId: string,
    clientIdentity: string,
  ) {
    await this.connection.transaction(async (manager) => {
      for (const change of changes) {
        switch (change.type) {
          case DatabaseChangeType.Create:
            await this.createEntity(
              scopeId,
              ownerId,
              change.table,
              change.key,
              change.obj,
              clientIdentity,
              manager,
            );
            break;
          case DatabaseChangeType.Update:
            await this.updateEntity(
              scopeId,
              ownerId,
              change.table,
              change.key,
              change.mods,
              clientIdentity,
              manager,
            );
            break;
          case DatabaseChangeType.Delete:
            await this.delete(
              scopeId,
              ownerId,
              change.table,
              change.key,
              clientIdentity,
              manager,
            );
            break;
        }
      }
    });
  }

  private async createEntity(
    scopeId: string,
    ownerId: string,
    table: string,
    key: string,
    obj: Record<string, unknown>,
    clientIdentity: string,
    manager: EntityManager,
  ) {
    await this.vaultEntitiesRepo
      .createQueryBuilder()
      .insert()
      .values({
        scopeId,
        ownerId,
        key,
        // eslint-disable-next-line @typescript-eslint/ban-types
        obj: obj as object,
      })
      .onConflict(
        '("ownerId", "scopeId", "key") DO UPDATE SET "obj" = excluded."obj"',
      )
      .execute();

    const change = this.entityChangesRepo.create({
      key,
      source: clientIdentity,
      type: DatabaseChangeType.Create,
      table,
      obj,
      scopeId,
      ownerId,
    });

    return (await this.saveChangeWithIncrement(manager, change)).rev;
  }

  private async updateEntity(
    scopeId: string,
    ownerId: string,
    table: string,
    key: string,
    modifications: IUpdateChange['mods'],
    clientIdentity: string,
    manager: EntityManager,
  ) {
    const entity = await this.vaultEntitiesRepo.findOne({ key });

    if (!entity) {
      throw new Error(`entity not found with key ${key}`);
    }

    applyModifications(entity.obj, modifications);

    await manager.save(entity);

    const change = this.entityChangesRepo.create({
      key: key,
      source: clientIdentity,
      type: DatabaseChangeType.Update,
      table: table,
      scopeId: scopeId,
      ownerId,
      mods: modifications,
    });

    return (await this.saveChangeWithIncrement(manager, change)).rev;
  }

  private async delete(
    scopeId: string,
    ownerId: string,
    table: string,
    key: string,
    clientIdentity: string,
    manager: EntityManager,
  ) {
    try {
      await this.vaultEntitiesRepo.delete({ key });
    } catch (e) {
      console.error(`Failed to remove entity with key ${key}`);
    }

    const change = this.entityChangesRepo.create({
      key: key,
      source: clientIdentity,
      type: DatabaseChangeType.Delete,
      table: table,
      scopeId: scopeId,
      ownerId,
    });

    return (await this.saveChangeWithIncrement(manager, change)).rev;
  }

  private async saveChangeWithIncrement(
    manager: EntityManager,
    model: EntityChangeSchema,
  ) {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(this.entityChangesRepo.metadata.tableName)
      .values({
        ...model,
        rev: () =>
          `(${manager
            .createQueryBuilder()
            .select('coalesce(max(entityChanges.rev) + 1, 1)')
            .from(this.entityChangesRepo.metadata.tableName, 'entityChanges')
            .where('entityChanges.scopeId = :id')
            .andWhere('entityChanges.ownerId = :ownerId')
            .getSql()})`,
      })
      .setParameter('ownerId', model.ownerId)
      .setParameter('id', model.scopeId)
      .returning('*')
      .execute();

    return this.entityChangesRepo.create(result.generatedMaps[0]);
  }
}

function applyModifications(
  obj: Record<string, unknown>,
  modifications: IUpdateChange['mods'],
) {
  Object.keys(modifications).forEach(function (keyPath) {
    set(obj, keyPath, modifications[keyPath]);
  });
}
