import sql, { empty, join, raw } from 'sql-template-tag';

export const generateInsert = (
  tableName: string,
  objs: Record<string, unknown>[],
  replace = false,
) => {
  if (objs.length === 0) throw new Error("Can't insert empty objects");

  const keys = Object.keys(objs[0]);

  const values = join(
    objs.map((obj) => sql`(${join(keys.map((k) => obj[k] as string))})`),
  );

  return sql`INSERT ${replace ? sql`OR REPLACE` : empty} INTO ${raw(
    tableName,
  )} (${join(keys.map((k) => raw(k)))}) VALUES ${values}`;
};

export const generateUpdate = (
  tableName: string,
  obj: Record<string, unknown>,
) => {
  const values = join(
    Object.entries(obj).map(([k, v]) => sql`${raw(k)} = ${v as string}`),
  );

  return sql`UPDATE ${raw(tableName)} SET ${values}`;
};
