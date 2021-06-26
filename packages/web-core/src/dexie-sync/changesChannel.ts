import type { IDatabaseChange } from '@harika/common';
import { BroadcastChannel } from 'broadcast-channel';
import { fromEvent, merge, Subject } from 'rxjs';

export type ITransmittedChange = IDatabaseChange & {
  fromServer: boolean;
  windowId: string;
  transactionSource: string;
};

export const globalChangesSubject = new Subject<ITransmittedChange[]>();
const changesChannel = new BroadcastChannel<ITransmittedChange[]>('changes');

globalChangesSubject.subscribe((changes) => {
  changesChannel.postMessage(changes);
});

export const changes$ = merge(
  fromEvent(changesChannel, 'message'),
  globalChangesSubject,
);
