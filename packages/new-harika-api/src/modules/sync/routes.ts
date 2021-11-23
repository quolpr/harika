import { FastifyPluginCallback } from 'fastify';
import { createChangesSchema } from './createUserSchema';

export const syncHandler: FastifyPluginCallback = (server, options, next) => {
  server.get('/', async (req, res) => {
    await createChangesSchema(req.db, 'db_user2');

    res.send({ status: 'ok' });
  });

  next();
};
