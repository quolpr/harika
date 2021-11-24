import 'reflect-metadata';
import fp from 'fastify-plugin';
import knex from 'knex';

export const pg = knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: 'postgres',
    database: 'harika_dev',
  },
  log: {
    // warn(message) {
    //   console.log(message);
    // },
    // error(message) {
    //   console.log(message);
    // },
    // deprecate(message) {
    //   console.log(message);
    // },
    // debug(message) {
    //   console.log(message);
    // },
  },
});

export const dbPlugin = fp(async (server) => {
  server.decorateRequest('db', pg);
});
