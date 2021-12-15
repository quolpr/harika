import 'reflect-metadata';
import fp from 'fastify-plugin';
import knex from 'knex';

export const pg = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },

  pool: {
    min: parseInt(process.env.DB_POOL_MIN, 10),
    max: parseInt(process.env.DB_POOL_MAX, 10),
  },
});

export const dbPlugin = fp(async (server) => {
  server.decorateRequest('db', pg);
});
