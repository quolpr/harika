import { FastifyPluginCallback } from 'fastify';

import { db } from '../../db/db';

export const healthHandler: FastifyPluginCallback = (server, options, next) => {
  server.get('/readiness_check', async (req, res) => {
    res.code(200).send({ status: 'ok' });
  });

  server.get('/db_check', async (req, res) => {
    try {
      const qRes = await db.select(1);

      if (qRes.length === 0) {
        throw new Error('Bad db');
      }

      res.code(200).send({ status: 'ok' });
    } catch (e) {
      console.error(e);
      res.code(500).send({ status: 'error' });
    }
  });

  next();
};
