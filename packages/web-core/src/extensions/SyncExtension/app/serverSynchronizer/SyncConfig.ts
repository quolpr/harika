import { Remote } from 'comlink';
import { inject, injectable } from 'inversify';
import { AnyModel } from 'mobx-keystone';
import { Class } from 'utility-types';
import { RemoteRegister } from '../../../../framework/RemoteRegister';
import { DB_NAME } from '../../../DbExtension/types';
import { IMapper } from '../mappers';
import { BaseSyncRepository } from '../../worker/BaseSyncRepository';
import { CreationDataWithId, SyncModelId } from '../../types';

export type IRegistration = {
  mapper: IMapper;
  repo: Remote<BaseSyncRepository>;
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

  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {}

  getRegistrationByModelClass(klass: Class<AnyModel>) {
    return this.registeredRepos.find((r) => r.mapper.model === klass);
  }

  getRegistrationByTable(table: string) {
    return this.registeredRepos.find((r) => r.mapper.tableName === table);
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
      repo: this.remoteRegister.getRemote(repo),
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
      arg: [CreationDataWithId<Model1>[]],
      deletedIds: [SyncModelId<Model1>[]],
    ) => void,
  ): () => void;
  onModelChange<Model1 extends AnyModel, Model2 extends AnyModel>(
    models: [Class<Model1>, Class<Model2>],
    callback: (
      arg: [CreationDataWithId<Model1>[], CreationDataWithId<Model2>[]],
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
        CreationDataWithId<Model1>[],
        CreationDataWithId<Model2>[],
        CreationDataWithId<Model3>[],
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
