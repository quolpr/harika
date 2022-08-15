/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BroadcastChannel } from 'broadcast-channel';
import { withoutUndo as withoutUndoFunc } from 'mobx-keystone';
import { Observable, ReplaySubject, share } from 'rxjs';

export function withoutUndoAction(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  const originalMethod = descriptor.value;

  //wrapping the original method
  descriptor.value = function (...args: any[]) {
    return withoutUndoFunc(() => {
      return originalMethod.apply(this, args);
    });
  };
}

export const getBroadcastCh$ = (name: string) => {
  return new Observable<BroadcastChannel>((sub) => {
    let currentChannel: BroadcastChannel | undefined = undefined;

    const createChannel = () => {
      currentChannel = new BroadcastChannel(name, {
        webWorkerSupport: true,
        idb: {
          onclose: () => {
            // the onclose event is just the IndexedDB closing.
            // you should also close the channel before creating
            // a new one.
            void currentChannel?.close();
            createChannel();
          },
        },
      });

      sub.next(currentChannel);
    };

    createChannel();

    return () => {
      void currentChannel?.close();
    };
  }).pipe(
    share({
      connector: () => new ReplaySubject(1),
    }),
  );
};
