import { DocChangeType } from '@harika/sync-common';
import { inject, injectable } from 'inversify';
import { groupBy, isEmpty } from 'lodash-es';
import { AnyModel } from 'mobx-keystone';
import { buffer, debounceTime, Observable, takeUntil } from 'rxjs';

import { STOP_SIGNAL, WINDOW_ID } from '../../../framework/types';
import { ITransmittedChange } from '../repositories/SyncRepository';
import { ISubscription, SyncConfig } from '../serverSynchronizer/SyncConfig';
import { CreationDataWithId, SyncModelId } from '../types';
import { DbEventsListenService } from './DbEventsListenerService';

@injectable()
export class OnDbChangeNotifier {
  constructor(
    @inject(WINDOW_ID) private currentWindowId: string,
    @inject(DbEventsListenService)
    dbChangeListenService: DbEventsListenService,
    @inject(SyncConfig) private syncConfig: SyncConfig,
    @inject(STOP_SIGNAL) stop$: Observable<void>,
  ) {
    const changes$ = dbChangeListenService.changesChannel$();

    changes$
      .pipe(buffer(changes$.pipe(debounceTime(300))), takeUntil(stop$))
      .subscribe((evs) => {
        this.handleEvents(evs.flat());
      });
  }

  private handleEvents(evs: ITransmittedChange[]) {
    evs = evs.filter(
      ({ windowId, source }) =>
        // we are going to pick all events except one that came from current mobx
        windowId !== this.currentWindowId || source === 'inDbChanges',
    );

    console.log('New events need to notify', JSON.stringify(evs));

    if (evs.length === 0) return;

    const groupedMappedData = this.getGroupedMappedData(evs);

    this.syncConfig.getRegisteredSubscribers().forEach((sub) => {
      this.notifySubscriberIfAnyData(groupedMappedData, sub);
    });
  }

  private getGroupedMappedData = (evs: ITransmittedChange[]) => {
    const grouped = groupBy(evs, (ev) => ev.collectionName);
    const groupedMappedData: Record<
      string,
      { toDeleteIds: SyncModelId[]; toCreateOrUpdateData: CreationDataWithId[] }
    > = {};

    for (const tableName in grouped) {
      const registration =
        this.syncConfig.getRegistrationByCollectionName(tableName);

      if (!registration) {
        continue;
      }

      const toDeleteStringIds: Set<string> = new Set();
      const toDeleteIds: SyncModelId[] = [];
      const toCreateOrUpdateData: CreationDataWithId[] = [];

      grouped[tableName].forEach((ev) => {
        if (ev.type === DocChangeType.Delete) {
          toDeleteStringIds.add(ev.docId);

          toDeleteIds.push({
            value: ev.docId,
            model: registration.mapper.model,
          });
        }
      });

      grouped[tableName].forEach((ev) => {
        if (toDeleteStringIds.has(ev.docId)) return;

        if (ev.type === DocChangeType.Create) {
          toCreateOrUpdateData.push(registration.mapper.mapToModelData(ev.doc));
        } else if (ev.type === DocChangeType.Update) {
          if (!ev.doc) {
            console.error(
              `Failed to apply ${JSON.stringify(ev)} — obj is not set`,
            );
            return;
          }
          toCreateOrUpdateData.push(registration.mapper.mapToModelData(ev.doc));
        }
      });

      groupedMappedData[tableName] = {
        toDeleteIds,
        toCreateOrUpdateData,
      };
    }

    return groupedMappedData;
  };

  private notifySubscriberIfAnyData(
    groupedMappedData: ReturnType<OnDbChangeNotifier['getGroupedMappedData']>,
    subscription: ISubscription,
  ) {
    const toCreateOrUpdateDatas: CreationDataWithId<AnyModel>[][] = [];
    const toDeleteIds: SyncModelId<AnyModel>[][] = [];

    subscription.modelClasses.forEach((klass) => {
      const registration = this.syncConfig.getRegistrationByModelClass(klass);

      if (!registration) {
        toCreateOrUpdateDatas.push([]);
        toDeleteIds.push([]);
        return;
      }

      const mappedData = groupedMappedData[registration.mapper.collectionName];

      if (!mappedData) {
        toCreateOrUpdateDatas.push([]);
        toDeleteIds.push([]);
        return;
      }

      toCreateOrUpdateDatas.push(mappedData.toCreateOrUpdateData);
      toDeleteIds.push(mappedData.toDeleteIds);
    });

    if (
      toCreateOrUpdateDatas.every((d) => isEmpty(d)) &&
      toDeleteIds.every((d) => isEmpty(d))
    ) {
      return;
    }

    subscription.callback(toCreateOrUpdateDatas, toDeleteIds);
  }
}
