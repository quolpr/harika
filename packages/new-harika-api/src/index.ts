import { Knex } from 'knex';
import createServer from './server';

declare module 'fastify' {
  interface FastifyRequest {
    db: Knex;
  }
}

const PORT = process.env.PORT || '5000';
const server = createServer();

server.listen(+PORT, '0.0.0.0', (err, address) => {
  if (err) throw err;
  console.log(`server listening on ${address}`);
});

module.exports = server;
