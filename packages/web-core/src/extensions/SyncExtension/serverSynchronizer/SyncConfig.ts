import { Container, inject, injectable } from 'inversify';
import { AnyModel, SnapshotInOf } from 'mobx-keystone';
import { Class } from 'utility-types';
import { IMapper } from '../mappers';
import { BaseSyncRepository } from '../BaseSyncRepository';
import { CreationDataWithId, SyncModelId } from '../types';

export type IRegistration = {
  mapper: IMapper;
  repo: BaseSyncRepository;
};

export type ISubscription = {
  callback: (
    arg: CreationDataWithId<AnyModel>[][],
    deletedIds: SyncModelId<AnyModel>[][],
  ) => void;
  modelClasses: Class<AnyModel>[];
};

@injectable()
export class SyncConfig {
  private registeredRepos: IRegistration[] = [];
  private registeredSubscribers: ISubscription[] = [];

  constructor(@inject(Container) private container: Container) {}

  getRegistrationByModelClass(klass: Class<AnyModel>) {
    return this.registeredRepos.find((r) => r.mapper.model === klass);
  }

  getRegistrationByCollectionName(table: string) {
    return this.registeredRepos.find((r) => r.mapper.collectionName === table);
  }

  getRegisteredSubscribers() {
    return this.registeredSubscribers;
  }

  registerSyncRepo<Doc = any, Model extends AnyModel = AnyModel>(
    mapper: IMapper<Doc, Model>,
    repo: Class<BaseSyncRepository>,
  ) {
    const repoConfig = {
      mapper,
      repo: this.container.get<BaseSyncRepository>(repo),
    };

    this.registeredRepos.push(repoConfig);

    return () => {
      this.registeredRepos = this.registeredRepos.filter((iRepoConfig) => {
        return iRepoConfig !== repoConfig;
      });
    };
  }

  onModelChange<Model1 extends AnyModel>(
    models: Class<Model1>[],
    callback: (
      arg: [SnapshotInOf<Model1>[]],
      deletedIds: [SyncModelId<Model1>[]],
    ) => void,
  ): () => void;
  onModelChange<Model1 extends AnyModel, Model2 extends AnyModel>(
    models: [Class<Model1>, Class<Model2>],
    callback: (
      arg: [SnapshotInOf<Model1>[], SnapshotInOf<Model2>[]],
      deletedIds: [SyncModelId<Model1>[], SyncModelId<Model2>[]],
    ) => void,
  ): () => void;
  onModelChange<
    Model1 extends AnyModel,
    Model2 extends AnyModel,
    Model3 extends AnyModel,
  >(
    models: [Class<Model1>, Class<Model2>, Class<Model3>],
    callback: (
      arg: [
        SnapshotInOf<Model1>[],
        SnapshotInOf<Model2>[],
        SnapshotInOf<Model3>[],
      ],
      deletedIds: [
        SyncModelId<Model1>[],
        SyncModelId<Model2>[],
        SyncModelId<Model3>[],
      ],
    ) => void,
  ): () => void;
  onModelChange(
    modelClasses: Class<AnyModel>[],
    callback: (toCreateOrUpdate: any, deletedIds: any) => void,
  ): () => void {
    const subscription = {
      modelClasses,
      callback,
    };

    this.registeredSubscribers.push(subscription);

    return () => {
      this.registeredSubscribers = this.registeredSubscribers.filter((s) => {
        return s !== subscription;
      });
    };
  }
}
