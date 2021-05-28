import { Buffer } from 'buffer';
import { connectReduxDevTools } from 'mobx-keystone';

(window as any).Buffer = Buffer;

export const connect = async (toConnect: any, name: string) => {
  const remotedev = await import('remotedev');

  const connection = remotedev.connectViaExtension({
    name,
  });

  connectReduxDevTools(remotedev, connection, toConnect);

  return connection.unsubscribe;
};
