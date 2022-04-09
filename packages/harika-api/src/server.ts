import fastify from 'fastify';
import cors from 'fastify-cors';
import fastifyMultipart from 'fastify-multipart';
import fastifyReplyFrom from 'fastify-reply-from';

import { uploadHandler } from './modules/fileUploadRoute';
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

  server.register(fastifyMultipart);
  server.register(dbPlugin);
  server.register(syncHandler, { prefix: '/sync' });
  server.register(healthHandler);
  server.register(uploadHandler);
  server.register(fastifyReplyFrom, {
    base: 'http://localhost:4433/',
  });
  server.register(cors, {
    origin: ['http://localhost:3000', 'http://harika-dev:3000'],
    credentials: true,
  });

  server.setErrorHandler((error, req, res) => {
    console.error(error);

    req.log.error(error.toString());
    res.send({ error });
  });

  server.all('/auth/*', (request, reply) => {
    reply.from(`/${request.params['*']}`, {
      rewriteHeaders: (headers) => {
        return Object.fromEntries(
          Object.entries(headers).filter(([key, val]) => {
            if (key.includes('access-control-')) return false;
            if (key === 'content-length') return false;

            return true;
          })
        );
      },
    });
  });

  return server;
}

export default createServer;
