import { retryBackoff } from 'backoff-rxjs';
import { inject, injectable } from 'inversify';
import { groupBy } from 'lodash-es';
import { AnyModel } from 'mobx-keystone';
import {
  buffer,
  concatMap,
  debounceTime,
  defer,
  map,
  Observable,
  takeUntil,
} from 'rxjs';

import { STOP_SIGNAL } from '../../../framework/types';
import { BaseSyncRepository } from '../BaseSyncRepository';
import {
  IModelChange,
  ITrackChangeModel,
  ModelChangeType,
} from '../mobx-keystone/trackChanges';
import { SyncConfig } from '../serverSynchronizer/SyncConfig';
import { MODELS_CHANGES_PIPE } from '../types';

type Class<T = any> = new (...args: any[]) => T;

const compressChanges = <T extends AnyModel>(chs: IModelChange<T>[]) => {
  const modelsMap: Record<string, T> = {};
  const toCreateModels = new Set<T>();
  const toUpdateModels = new Set<T>();
  const toDeleteModels = new Set<T>();

  chs.forEach((ch) => {
    modelsMap[ch.model.$modelId] = ch.model;

    if (ch.type === ModelChangeType.Create) {
      if (toUpdateModels.has(ch.model)) {
        toUpdateModels.delete(ch.model);
      }
      if (toDeleteModels.has(ch.model)) {
        throw new Error("Can't create deleted model");
      }

      toCreateModels.add(ch.model);
    } else if (ch.type === ModelChangeType.Update) {
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
    @inject(MODELS_CHANGES_PIPE) pipe$: Observable<IModelChange>,
  ) {
    if (!pipe$) throw new Error('Root store changes subject not found');

    pipe$
      .pipe(
        buffer(pipe$.pipe(debounceTime(300))),
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

  private applyChanges = async (changes: IModelChange[]) => {
    if (changes.length === 0) return;

    for (const chs of Object.values(
      groupBy(changes, (ch) => ch.model.$modelType),
    )) {
      const reg = this.syncConfig.getRegistrationByModelClass(
        chs[0].model.constructor as Class<AnyModel>,
      );

      if (!reg) {
        console.error(
          `Couldn't find syne repo registration for ${JSON.stringify(
            chs[0].model,
          )}`,
        );

        return;
      }

      await this.apply(compressChanges(chs), reg.repo, reg.mapper.mapToDoc);
    }
  };

  private apply = <T>(
    result: {
      toCreateModels: ITrackChangeModel<T>[];
      toUpdateModels: ITrackChangeModel<T>[];
      toDeleteModels: ITrackChangeModel<T>[];
    },
    repo: BaseSyncRepository<any, any>,
    mapper: (model: T) => unknown,
  ) => {
    const ctx = {
      shouldRecordChange: true,
      source: 'inDomainChanges' as const,
    };

    return repo.bulkApplyChanges(
      result.toCreateModels.map((model) => mapper(model)),
      result.toUpdateModels.map((model) => mapper(model)),
      result.toDeleteModels.map(({ $modelId }) => $modelId),
      ctx,
    );
  };
}
