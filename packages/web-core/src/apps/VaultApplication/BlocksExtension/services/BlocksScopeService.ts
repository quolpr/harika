import { inject, injectable } from 'inversify';
import { isEqual } from 'lodash-es';
import { distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { withoutSync } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { NoteBlocksService } from '../../NoteBlocksExtension/services/NoteBlocksService';
import { BlocksScopeStore, getScopeKey } from '../models/BlocksScopeStore';
import { BlocksScopesRepository } from '../repositories/BlockScopesRepository';

@injectable()
export class BlocksScopesService {
  constructor(
    @inject(NoteBlocksService)
    private noteBlocksService: NoteBlocksService,
    @inject(BlocksScopesRepository)
    private blocksScopesRepo: BlocksScopesRepository,
    @inject(BlocksScopeStore)
    private blocksScopesStore: BlocksScopeStore,
  ) {}

  getScopedBlockById$(
    blockId: string,
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockViewId?: string,
  ) {
    return this.noteBlocksService.getNoteIdByBlockId$(blockId).pipe(
      switchMap((noteId) =>
        noteId
          ? this.getBlocksScope$(noteId, scopedBy, rootBlockViewId)
          : of(undefined),
      ),
      map((blocksScope) =>
        blocksScope ? blocksScope.rootScopedBlock : undefined,
      ),
    );
  }

  getBlocksScope$(
    noteId: string,
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockViewId?: string,
  ) {
    return this.getBlocksScopes$([{ noteId, scopedBy, rootBlockViewId }]).pipe(
      map((r) => r[0]),
    );
  }

  getBlocksScopes$(
    args: {
      noteId: string;
      scopedBy: { $modelId: string; $modelType: string };
      rootBlockViewId?: string;
    }[],
  ) {
    return this.noteBlocksService
      .getBlocksRegistryByNoteIds$(args.map(({ noteId }) => noteId))
      .pipe(
        map((registries) => {
          const byIds = Object.fromEntries(
            registries.map((reg) => [reg.noteId, reg]),
          );

          return args
            .map((arg) => {
              const registry = byIds[arg.noteId];

              if (!registry) {
                console.error(
                  `For ${JSON.stringify(arg)} blocks registry not found!`,
                );

                return undefined;
              }

              return {
                ...arg,
                blockModelsRegistry: registry,
                rootBlockViewId: arg.rootBlockViewId || registry.rootBlockId,
              };
            })
            .flatMap((f) => (f ? [f] : []));
        }),
        switchMap(async (args) => {
          const argsWithKey = args.map((arg) => ({
            ...arg,
            key: getScopeKey(
              arg.noteId,
              arg.scopedBy.$modelType,
              arg.scopedBy.$modelId,
              arg.rootBlockViewId,
            ),
          }));

          const scopesFromDb = Object.fromEntries(
            (
              await this.blocksScopesRepo.getByIds(
                args.map((arg) =>
                  getScopeKey(
                    arg.noteId,
                    arg.scopedBy.$modelType,
                    arg.scopedBy.$modelId,
                    arg.rootBlockViewId,
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
