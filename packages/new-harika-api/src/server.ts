import fastify from 'fastify';

import { dbPlugin } from './plugins/db';
import { healthHandler } from './modules/health/routes';
import { syncHandler } from './modules/sync/routes';

function createServer() {
  const server = fastify();
  server.register(require('fastify-cors'));

  server.register(require('fastify-oas'), {
    routePrefix: '/docs',
    exposeRoute: true,
    swagger: {
      info: {
        title: 'product api',
        description: 'api documentation',
        version: '0.1.0',
      },
      servers: [
        { url: 'http://localhost:5000', description: 'development' },
        {
          url: 'https://<production-url>',
          description: 'production',
        },
      ],
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
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
