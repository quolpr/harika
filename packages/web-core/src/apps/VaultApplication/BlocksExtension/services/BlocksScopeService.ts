import { inject, injectable } from 'inversify';
import { isEqual } from 'lodash-es';
import { distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { withoutSync } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { BlocksScopeStore, getScopeKey } from '../models/BlocksScopeStore';
import { BlocksScopesRepository } from '../repositories/BlockScopesRepository';

@injectable()
export class BlocksScopesService {
  constructor(
    @inject(BlocksScopesRepository)
    private blocksScopesRepo: BlocksScopesRepository,
    @inject(BlocksScopeStore)
    private blocksScopesStore: BlocksScopeStore,
  ) {}

  getBlocksScope$(
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockId: string,
  ) {
    return this.getBlocksScopes$([{ scopedBy, rootBlockId }]).pipe(
      map((r) => r[0]),
    );
  }

  getBlocksScopes$(
    args: {
      scopedBy: { $modelId: string; $modelType: string };
      rootBlockId: string;
    }[],
  ) {
    return of(args).pipe(
      switchMap(async (args) => {
        const argsWithKey = args.map((arg) => ({
          ...arg,
          key: getScopeKey(
            arg.scopedBy.$modelType,
            arg.scopedBy.$modelId,
            arg.rootBlockId,
          ),
        }));

        const scopesFromDb = Object.fromEntries(
          (
            await this.blocksScopesRepo.getByIds(
              args.map((arg) =>
                getScopeKey(
                  arg.scopedBy.$modelType,
                  arg.scopedBy.$modelId,
                  arg.rootBlockId,
                ),
              ),
            )
          ).map((doc) => [doc.id, doc]),
        );

        const inDb = withoutSync(() => {
          return this.blocksScopesStore.getOrCreateScopes(
            argsWithKey
              .filter((arg) => scopesFromDb[arg.key])
              .map((arg) => {
                return {
                  ...arg,
                  collapsedBlockIds: scopesFromDb[arg.key].collapsedBlockIds,
                };
              }),
          );
        });

        const notInDb = (() => {
          return this.blocksScopesStore.getOrCreateScopes(
            argsWithKey
              .filter((arg) => !scopesFromDb[arg.key])
              .map((arg) => {
                return {
                  ...arg,
                  collapsedBlockIds: [],
                };
              }),
          );
        })();

        return [...inDb, ...notInDb];
      }),
      distinctUntilChanged((a, b) => isEqual(a, b)),
    );
  }
}
