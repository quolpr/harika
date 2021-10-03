import { Observable, ObservableInput } from 'rxjs';
//@ts-ignore
import workerUrl from './SRWorker?url';

export class SRApp {
  constructor(
    private liveQuery: <T>(
      tables: string[],
      query: () => ObservableInput<T>,
    ) => Observable<T>,
  ) {}

  static worker() {
    return { url: workerUrl, name: 'SRWorker' };
  }
}
