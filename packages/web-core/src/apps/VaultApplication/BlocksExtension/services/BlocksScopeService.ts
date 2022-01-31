import { inject, injectable } from 'inversify';
import { isEqual } from 'lodash-es';
import { withoutUndo } from 'mobx-keystone';
import { distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { withoutSync } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { blocksScopesMapper } from '../mappers/blockScopesMapper';
import { BlocksScope } from '../models/BlocksScope';
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

  async getBlocksScope(
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockId: string,
  ) {
    return (await this.getBlocksScopes([{ scopedBy, rootBlockId }]))[0];
  }

  async getBlocksScopes(
    args: {
      scopedBy: { $modelId: string; $modelType: string };
      rootBlockId: string;
    }[],
  ) {
    const toLoadScopes = args.filter(
      ({ scopedBy, rootBlockId }) =>
        !this.blocksScopesStore.isScopePresent(scopedBy, rootBlockId),
    );

    const scopesFromDb =
      toLoadScopes.length !== 0
        ? await this.blocksScopesRepo.getByIds(
            toLoadScopes.map((arg) =>
              getScopeKey(
                arg.scopedBy.$modelId,
                arg.scopedBy.$modelType,
                arg.rootBlockId,
              ),
            ),
          )
        : [];

    withoutUndo(() => {
      toLoadScopes
        .filter(
          (scope) =>
            // O(n^2), but on small set should be ok
            !scopesFromDb.find(
              (doc) =>
                doc.id ===
                getScopeKey(
                  scope.scopedBy.$modelId,
                  scope.scopedBy.$modelType,
                  scope.rootBlockId,
                ),
            ),
        )
        .map((arg) =>
          this.blocksScopesStore.createScope(arg.scopedBy, arg.rootBlockId),
        );

      this.blocksScopesStore.handleModelChanges(
        scopesFromDb.map((doc) => blocksScopesMapper.mapToModelData(doc)),
        [],
      );
    });

    return args
      .map(
        (arg) =>
          this.blocksScopesStore.getScope(
            arg.scopedBy,
            arg.rootBlockId,
          ) as BlocksScope,
      )
      .filter((b) => Boolean(b));
  }
}
