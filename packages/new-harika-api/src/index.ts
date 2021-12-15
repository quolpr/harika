import './loadConfig';
import './initFirebase';
import { Knex } from 'knex';
import createServer from './server';

declare module 'fastify' {
  interface FastifyRequest {
    db: Knex;
  }
}

const PORT = process.env.APP_PORT || '5001';
const server = createServer();

server.listen(+PORT, '0.0.0.0', (err, address) => {
  if (err) throw err;
});

export { server };
