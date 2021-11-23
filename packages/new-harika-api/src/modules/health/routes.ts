import { FastifyPluginCallback } from 'fastify';
import { getHealthSchema } from './schema';

export const healthHandler: FastifyPluginCallback = (server, options, next) => {
  server.get('/', { schema: getHealthSchema }, async (req, res) => {
    console.log(await req.db.select('*').from('pg_catalog.pg_tables'));
    res.send({ status: 'ok' });
  });

  next();
};
