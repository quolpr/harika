import './plugins/initSuperTokens';

import fastify from 'fastify';
import cors from 'fastify-cors';
import formDataPlugin from 'fastify-formbody';
import supertokens from 'supertokens-node';
import { plugin } from 'supertokens-node/framework/fastify';
import { errorHandler } from 'supertokens-node/framework/fastify';

import { healthHandler } from './modules/health/routes';
import { syncHandler } from './modules/sync/routes';
import { dbPlugin } from './plugins/db';

async function createServer() {
  const server = fastify({ logger: true });

  // server.register(fastifyCors, {
  //   origin: (origin, cb) => {
  //     if (!origin) {
  //       cb(null, true);
  //       return;
  //     }

  //     if (/localhost/.test(origin) || origin.includes('127.0.0.1')) {
  //       //  Request from localhost will pass
  //       cb(null, true);
  //       return;
  //     }
  //     // Generate an error on other origins, disabling access
  //     cb(new Error('Not allowed'), false);
  //   },
  // });

  server.register(dbPlugin);
  server.register(syncHandler, { prefix: '/sync' });
  server.register(healthHandler);

  server.register(cors, {
    origin: 'http://localhost:3000',
    allowedHeaders: ['Content-Type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  server.setErrorHandler(errorHandler());
  server.setErrorHandler((error, req, res) => {
    console.error(error);
    req.log.error(error.toString());
    res.send({ error });
  });

  await server.register(formDataPlugin);
  await server.register(plugin);

  return server;
}

export default createServer;
