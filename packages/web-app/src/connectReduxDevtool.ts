/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Buffer } from 'buffer';
import { connectReduxDevTools } from 'mobx-keystone';

(window as any).Buffer = Buffer;

export const connect = async (toConnect: any, name: string) => {
  const remotedev = await import('remotedev');

  const connection = remotedev.connectViaExtension({
    name,
  });

  connectReduxDevTools(remotedev, connection, toConnect, {
    logArgsNearName: false,
  });

  return connection.unsubscribe;
};
