import { createServer } from 'http';
import Client from 'socket.io-client';
import { Server } from 'socket.io';
import { assert } from 'chai';

// beforeEach(async () => {
//   server = await require('../src/index');
//   await server.ready();
// });

// afterAll(() => server.close());

describe('my awesome project', () => {
  let server, clientSocket;

  beforeEach(async (done) => {
    server = await require('../src/index');
    await server.ready();

    clientSocket = Client(`http://localhost:5100`);

    done();
    // server.server.listen(() => {

    //   clientSocket.on('connect', done);
    // });
  });

  afterAll(() => {
    clientSocket.close();
    server.close();
  });

  test('should work', (done) => {
    clientSocket.emit('message', 'test', (resp) => {
      console.log({ resp });
      done();
    });
  });
});
