import { retryBackoff } from 'backoff-rxjs';
import { inject, injectable } from 'inversify';
import { groupBy } from 'lodash-es';
import { AnyModel } from 'mobx-keystone';
import {
  buffer,
  debounceTime,
  map,
  concatMap,
  defer,
  takeUntil,
  Observable,
} from 'rxjs';
import { STOP_SIGNAL } from '../../../../framework/types';
import {
  ISyncableModel,
  ISyncableModelChange,
  syncableModelChangesPipe$,
  SyncableModelChangeType,
} from '../mobx-keystone/syncable';
import { BaseSyncRepository } from '../../worker/BaseSyncRepository';
import { SyncConfig } from '../serverSynchronizer/SyncConfig';

type Class<T = any> = new (...args: any[]) => T;

const compressChanges = <T extends AnyModel>(
  chs: ISyncableModelChange<T>[],
) => {
  const modelsMap: Record<string, T> = {};
  const toCreateModels = new Set<T>();
  const toUpdateModels = new Set<T>();
  const toDeleteModels = new Set<T>();

  chs.forEach((ch) => {
    modelsMap[ch.model.$modelId] = ch.model;

    if (ch.type === SyncableModelChangeType.Create) {
      if (toUpdateModels.has(ch.model)) {
        toUpdateModels.delete(ch.model);
      }
      if (toDeleteModels.has(ch.model)) {
        throw new Error("Can't create deleted model");
      }

      toCreateModels.add(ch.model);
    } else if (ch.type === SyncableModelChangeType.Update) {
      if (toCreateModels.has(ch.model)) return;
      if (toDeleteModels.has(ch.model)) return;

      toUpdateModels.add(ch.model);
    } else {
      if (toCreateModels.has(ch.model)) {
        toCreateModels.delete(ch.model);
      }
      if (toUpdateModels.has(ch.model)) {
        toUpdateModels.delete(ch.model);
      }

      toDeleteModels.add(ch.model);
    }
  });

  return {
    toCreateModels: Array.from(toCreateModels),
    toUpdateModels: Array.from(toUpdateModels),
    toDeleteModels: Array.from(toDeleteModels),
  };
};

@injectable()
export class ToDbSynchronizer {
  constructor(
    @inject(SyncConfig) private syncConfig: SyncConfig,
    @inject(STOP_SIGNAL) stop$: Observable<void>,
  ) {
    syncableModelChangesPipe$
      .pipe(
        buffer(syncableModelChangesPipe$.pipe(debounceTime(300))),
        map((changes) => changes.flat()),
        concatMap((changes) => {
          return defer(() => this.applyChanges(changes)).pipe(
            retryBackoff({
              initialInterval: 500,
              maxRetries: 5,
              resetOnSuccess: true,
            }),
          );
        }),
        takeUntil(stop$),
      )
      .subscribe({
        error: (e: unknown) => {
          console.error('Failed to save changes to db!');

          throw e;
        },
      });
  }

  private applyChanges = async (changes: ISyncableModelChange[]) => {
    if (changes.length === 0) return;

    Object.entries(groupBy(changes, (ch) => ch.model.$modelType)).forEach(
      ([, chs]) => {
        const reg = this.syncConfig.getRegistrationByModelClass(
          chs[0].model.constructor as Class<AnyModel>,
        );

        if (!reg) {
          // console.error(
          //   `Couldn't find syne repo registration for ${JSON.stringify(
          //     chs[0].model,
          //   )}`,
          // );
          return;
        }

        this.apply(compressChanges(chs), reg.repo, reg.mapper.mapToDoc);
      },
    );
  };

  private apply = <T>(
    result: {
      toCreateModels: ISyncableModel<T>[];
      toUpdateModels: ISyncableModel<T>[];
      toDeleteModels: ISyncableModel<T>[];
    },
    repo: BaseSyncRepository<any, any>,
    mapper: (model: T) => unknown,
  ) => {
    const ctx = {
      shouldRecordChange: true,
      source: 'inDomainChanges' as const,
    };

    return Promise.all([
      result.toCreateModels.length > 0
        ? repo.bulkCreate(
            result.toCreateModels.map((model) => mapper(model)),
            ctx,
          )
        : null,
      result.toUpdateModels.length > 0
        ? repo.bulkUpdate(
            result.toUpdateModels.map((model) => mapper(model)),
            ctx,
          )
        : null,
      result.toDeleteModels.length > 0
        ? repo.bulkDelete(
            result.toDeleteModels.map(({ $modelId }) => $modelId),
            ctx,
          )
        : null,
    ]);
  };
}
