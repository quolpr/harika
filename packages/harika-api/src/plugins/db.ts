import fp from 'fastify-plugin';

import { db } from '../db/db';

export const dbPlugin = fp(async (server) => {
  server.decorateRequest('db', db);
});
