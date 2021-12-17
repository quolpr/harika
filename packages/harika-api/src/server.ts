import fastify from 'fastify';

import { dbPlugin } from './plugins/db';
import { syncHandler } from './modules/sync/routes';
import fastifyCors from 'fastify-cors';
import { healthHandler } from './modules/health/routes';

function createServer() {
  const server = fastify({ logger: true });

  server.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (/localhost/.test(origin) || origin.includes('127.0.0.1')) {
        //  Request from localhost will pass
        cb(null, true);
        return;
      }
      // Generate an error on other origins, disabling access
      cb(new Error('Not allowed'), false);
    },
  });

  server.register(dbPlugin);
  server.register(syncHandler, { prefix: '/sync' });
  server.register(healthHandler);

  server.setErrorHandler((error, req, res) => {
    console.error(error);
    req.log.error(error.toString());
    res.send({ error });
  });

  return server;
}

export default createServer;
