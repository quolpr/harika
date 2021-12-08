import { Knex } from 'knex';
import { changesDbTable } from '../dbTypes';
import { IDocChange, IDocChangeWithRev } from '../types';

type NonConstructorKeys<T> = {
  [P in keyof T]: T[P] extends new () => any ? never : P;
}[keyof T];
type NonConstructor<T> = Pick<T, NonConstructorKeys<T>>;

export class ChangesService {
  constructor(private db: Knex, private schemaName: string) {}

  async getChangesAfterOrEqualClock(
    table: string,
    entityId: string,
    clock: string
  ): Promise<IDocChangeWithRev[]> {
    return await this.db
      .withSchema(this.schemaName)
      .from(changesDbTable)
      .where('timestamp', '>=', clock)
      .andWhere('table', table)
      .andWhere('key', entityId);
  }

  async isAnyChangeAfterClock(
    trx: Knex,
    table: string,
    entityId: string,
    afterClock: string,
    excludeIds: string[]
  ) {
    return Boolean(
      await trx
        .count('id')
        .withSchema(this.schemaName)
        .from(changesDbTable)
        .where('timestamp', '>=', afterClock)
        .andWhere('table', table)
        .andWhere('key', entityId)
        .whereNotIn('id', excludeIds)
    );
  }

  async getAllChanges(
    trx: Knex,
    table: string,
    entityId: string
  ): Promise<IDocChangeWithRev[]> {
    return await trx
      .withSchema(this.schemaName)
      .from(changesDbTable)
      .andWhere('table', table)
      .andWhere('key', entityId);
  }

  async insertChanges(
    trx: Knex,
    chs: IDocChange[]
  ): Promise<IDocChangeWithRev[]> {
    const insertResult = await trx
      .insert(chs, ['id', 'rev'])
      .withSchema(this.schemaName)
      .into('changes');

    const idRevMap = Object.fromEntries(
      insertResult.map(({ id, rev }) => [id, rev])
    );

    return chs.map((ch) => ({ ...ch, rev: idRevMap[ch.id] }));
  }
}

export type IChangesService = NonConstructor<ChangesService>;
