import './loadConfig';

import { Knex } from 'knex';

import createServer from './server';

declare module 'fastify' {
  interface FastifyRequest {
    db: Knex;
  }
}

const PORT = process.env.PORT || '5001';

(async () => {
  const server = await createServer();

  server.listen(+PORT, '0.0.0.0', (err, address) => {
    if (err) throw err;
  });
})();
