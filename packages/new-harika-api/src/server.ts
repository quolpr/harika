import fastify from 'fastify';

import { dbPlugin } from './plugins/db';
import { healthHandler } from './modules/health/routes';
import { syncHandler } from './modules/sync/routes';
import fastifyCors from 'fastify-cors';

function createServer() {
  const server = fastify();

  server.register(fastifyCors, {
    origin: (origin, cb) => {
      console.log(origin);

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
  server.register(healthHandler, { prefix: '/health' });
  server.register(syncHandler, { prefix: '/sync' });

  server.setErrorHandler((error, req, res) => {
    console.error(error);
    req.log.error(error.toString());
    res.send({ error });
  });

  return server;
}

export default createServer;
