import { inject, injectable } from 'inversify';
import { groupBy, isEmpty } from 'lodash-es';
import { AnyModel } from 'mobx-keystone';
import { Observable, takeUntil } from 'rxjs';
import { STOP_SIGNAL, WINDOW_ID } from '../../../framework/types';
import { ITransmittedChange } from '../repositories/SyncRepository';
import { ISubscription, SyncConfig } from '../serverSynchronizer/SyncConfig';
import { DatabaseChangeType } from '../serverSynchronizer/types';
import { DbEventsListenService } from '../services/DbEventsListenerService';
import { CreationDataWithId, SyncModelId } from '../types';

@injectable()
export class OnDbChangeNotifier {
  constructor(
    @inject(WINDOW_ID) private currentWindowId: string,
    @inject(DbEventsListenService)
    dbChangeListenService: DbEventsListenService,
    @inject(SyncConfig) private syncConfig: SyncConfig,
    @inject(STOP_SIGNAL) stop$: Observable<void>,
  ) {
    dbChangeListenService
      .changesChannel$()
      .pipe(takeUntil(stop$))
      .subscribe((evs) => {
        this.handleEvents(evs);
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
    const grouped = groupBy(evs, (ev) => ev.table);
    const groupedMappedData: Record<
      string,
      { toDeleteIds: SyncModelId[]; toCreateOrUpdateData: CreationDataWithId[] }
    > = {};

    for (const tableName in grouped) {
      const registration = this.syncConfig.getRegistrationByTable(tableName);

      if (!registration) {
        console.error('Failed to find sync registration for ' + tableName);
        continue;
      }

      const toDeleteIds: SyncModelId[] = [];
      const toCreateOrUpdateData: CreationDataWithId[] = [];

      grouped[tableName].forEach((ev) => {
        if (ev.type === DatabaseChangeType.Create) {
          toCreateOrUpdateData.push(registration.mapper.mapToModelData(ev.obj));
        } else if (ev.type === DatabaseChangeType.Update) {
          if (!ev.obj) {
            console.error(
              `Failed to apply ${JSON.stringify(ev)} — obj is not set`,
            );
            return;
          }
          toCreateOrUpdateData.push(registration.mapper.mapToModelData(ev.obj));
        } else if (ev.type === DatabaseChangeType.Delete) {
          toDeleteIds.push({
            value: ev.id,
            model: registration.mapper.model,
          });
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
        console.error('Failed to find sync registration for ' + klass);

        toCreateOrUpdateDatas.push([]);
        toDeleteIds.push([]);
        return;
      }

      const mappedData = groupedMappedData[registration.mapper.tableName];

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
