// @ts-ignore
import DbWorker from './DbWorker?worker';
import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import Q from 'sql-bricks';
import {
  filter,
  first,
  lastValueFrom,
  Observable,
  Subject,
  takeUntil,
  tap,
} from 'rxjs';
import {
  ICommand,
  IInputWorkerMessage,
  IOutputWorkerMessage,
} from './DbWorker';
import { inject } from 'inversify';
import { STOP_SIGNAL } from '../../framework/types';
import { v4 as uuidv4 } from 'uuid';
import { migrationsTable } from './DB';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

class DbFront {
  private worker: Worker;
  private messagesFromWorker$: Observable<IOutputWorkerMessage>;
  private messagesToWorker$: Subject<IInputWorkerMessage> = new Subject();

  constructor(@inject(STOP_SIGNAL) private stop$: Observable<void>) {
    this.worker = new DbWorker();

    initBackend(this.worker);

    this.messagesFromWorker$ = new Observable<IOutputWorkerMessage>((obs) => {
      const sub = (ev: MessageEvent<any>) => {
        obs.next(ev.data);
      };
      this.worker.addEventListener('message', sub);

      return () => {
        this.worker.removeEventListener('message', sub);
      };
    });

    this.messagesToWorker$.pipe(takeUntil(stop$)).subscribe((mes) => {
      this.worker.postMessage(mes);
    });
  }

  async init() {
    // maybe timeout?
    const prom = lastValueFrom(
      this.messagesFromWorker$.pipe(
        filter((ev) => ev.type === 'initialized'),
        first(),
      ),
    );

    this.messagesToWorker$.next({ type: 'initialize', dbName: 'test' });

    return prom;
  }

  async execQuery(query: Q.Statement, transactionId?: string) {
    return this.execCommand({
      type: 'execQuery',
      query: query.toParams(),
      transactionId,
    });
  }

  async startTransaction(): Promise<string> {
    const transactionId = uuidv4();

    await this.execCommand({
      type: 'startTransaction',
      transactionId,
    });

    return transactionId;
  }

  async commitTransaction(transactionId: string): Promise<void> {
    await this.execCommand({
      type: 'commitTransaction',
      transactionId,
    });
  }

  private execCommand(command: DistributiveOmit<ICommand, 'commandId'>) {
    const id = uuidv4();

    const prom = lastValueFrom(
      this.messagesFromWorker$.pipe(
        filter((ev) => ev.type === 'response' && ev.data.commandId === id),
        first(),
        tap((ev) => {
          if (ev.type === 'response' && ev.data.status === 'error') {
            throw new Error(ev.data.message);
          }
        }),
      ),
    );

    this.messagesToWorker$.next({
      type: 'command',
      data: { ...command, commandId: id },
    });

    return prom;
  }
}

const run = async () => {
  const dbFront = new DbFront(new Subject());

  await dbFront.init();

  console.log('initialized!!!!!!!!!!!!!');

  const transactionId = await dbFront.startTransaction();

  console.log(
    'result!!!!!!!!!!!!!',
    await dbFront.execQuery(Q.select('*').from(migrationsTable), transactionId),
  );

  await dbFront.commitTransaction(transactionId);
};

run();
