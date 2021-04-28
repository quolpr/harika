import { Connection, EntityManager, Repository } from 'typeorm';
import {
  DatabaseChangeType,
  EntityChangeSchema,
  EntitySchema,
  IDatabaseChange,
} from './types';
import set from 'lodash.set';

export abstract class SyncEntitiesService {
  constructor(
    private connection: Connection,
    private vaultEntitiesRepo: Repository<EntitySchema>,
    private entityChangesRepo: Repository<EntityChangeSchema>
  ) {}

  async getChangesFromRev(
    scopeId: string,
    rev: number,
    clientIdentity: string
  ): Promise<{ changes: IDatabaseChange[]; lastRev: number }> {
    const changes = await this.entityChangesRepo
      .createQueryBuilder('changes')
      .where('changes.source <> :clientIdentity', { clientIdentity })
      .andWhere('changes.rev > :rev', { rev })
      .andWhere('changes.scopeId = :scopeId', { scopeId })
      .getMany();

    // Todo: merge to query above, race condition may happen
    const lastRev = (
      await this.entityChangesRepo
        .createQueryBuilder('changes')
        .select(['MAX(changes.rev)'])
        .where('changes.scopeId = :scopeId', { scopeId })
        .getRawOne()
    ).max as number;

    return { changes: changes.map((ch) => ch.toChange()), lastRev };
  }

  async applyChanges(
    changes: IDatabaseChange[],
    vaultId: string,
    clientIdentity: string
  ) {
    await this.connection.transaction(async (manager) => {
      for (const change of changes) {
        switch (change.type) {
          case DatabaseChangeType.Create:
            console.log(
              'create',
              await this.createEntity(
                vaultId,
                change.table,
                change.key,
                change.obj,
                clientIdentity,
                manager
              )
            );
            break;
          case DatabaseChangeType.Update:
            await this.updateEntity(
              vaultId,
              change.table,
              change.key,
              change.mods,
              clientIdentity,
              manager
            );
            break;
          case DatabaseChangeType.Delete:
            await this.delete(
              vaultId,
              change.table,
              change.key,
              clientIdentity,
              manager
            );
            break;
        }
      }
    });
  }

  private async createEntity(
    scopeId: string,
    table: string,
    key: string,
    obj: Record<string, unknown>,
    clientIdentity: string,
    manager: EntityManager
  ) {
    const entity = this.vaultEntitiesRepo.create({
      scopeId,
      key,
      obj,
    });

    await manager.save(entity);

    const change = this.entityChangesRepo.create({
      key,
      source: clientIdentity,
      type: DatabaseChangeType.Create,
      table,
      obj,
      scopeId,
    });

    return (await this.saveChangeWithIncrement(manager, change)).rev;
  }

  private async updateEntity(
    scopeId: string,
    table: string,
    key: string,
    modifications: Record<string, string>,
    clientIdentity: string,
    manager: EntityManager
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
      mods: modifications,
    });

    return (await this.saveChangeWithIncrement(manager, change)).rev;
  }

  private async delete(
    scopeId: string,
    table: string,
    key: string,
    clientIdentity: string,
    manager: EntityManager
  ) {
    await this.vaultEntitiesRepo.delete({ key });

    const change = this.entityChangesRepo.create({
      key: key,
      source: clientIdentity,
      type: DatabaseChangeType.Delete,
      table: table,
      scopeId: scopeId,
    });

    return (await this.saveChangeWithIncrement(manager, change)).rev;
  }

  private async saveChangeWithIncrement(
    manager: EntityManager,
    model: EntityChangeSchema
  ) {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(this.entityChangesRepo.metadata.tableName)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      .values({
        ...model,
        rev: () =>
          `(${manager
            .createQueryBuilder()
            .select('coalesce(max(entityChanges.rev) + 1, 1)')
            .from(this.entityChangesRepo.metadata.tableName, 'entityChanges')
            .where('entityChanges.scopeId = :id', {
              id: model.scopeId,
            })
            .getSql()})`,
      })
      .returning('*')
      .execute();

    return this.entityChangesRepo.create(result.generatedMaps[0]);
  }
}

function applyModifications(
  obj: Record<string, unknown>,
  modifications: Record<string, string>
) {
  Object.keys(modifications).forEach(function (keyPath) {
    set(obj, keyPath, modifications[keyPath]);
  });
}
