import { injectable } from 'inversify';
import { BehaviorSubject } from 'rxjs';

export type IConnectionConfig = {
  url: string;
  authToken: string;
};

@injectable()
export class SyncConnectionConfig {
  public config$ = new BehaviorSubject<IConnectionConfig | undefined>(
    undefined,
  );
}
