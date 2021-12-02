// import Client from 'socket.io-client';
// import { FastifyInstance } from 'fastify';

it('works', () => {});
// describe('my awesome project', () => {
//   let server: FastifyInstance, clientSocket: SocketIOClient.Socket;

//   beforeEach(async (done) => {
//     server = (await require('../src/index')).server;
//     await server.ready();
//     clientSocket = Client(`http://localhost:${process.env.APP_PORT}`);
//     done();
//   });

//   afterAll(() => {
//     clientSocket.close();
//     server.close();
//   });

//   // test('getChanges should work', (done) => {
//   //   clientSocket.emit('getChanges', 'test', (resp) => {
//   //     console.log({ resp });
//   //     done();
//   //   });
//   // });

//   test('auth should work', async (done) => {
//     await new Promise<void>((resolve) => {
//       clientSocket.emit('auth', 'test', (resp) => {
//         resolve();
//       });
//     });

//     clientSocket.emit('getChanges', 'test', (resp) => {
//       console.log({ resp });
//       done();
//     });
//   });
// });
