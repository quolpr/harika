import { Remote } from 'comlink';
import { inject, injectable } from 'inversify';
import { isEqual } from 'lodash-es';
import { switchMap, distinctUntilChanged, map, of } from 'rxjs';
import { toRemoteName } from '../../../../framework/utils';
import { NoteBlocksService } from '../../NoteBlocksExtension/services/NoteBlocksService';
import { NotesStore } from '../../NotesExtension/models/NotesStore';
import { BlocksScopeStore, getScopeKey } from '../models/BlocksScopeStore';
import { BlocksScopesRepository } from '../repositories/BlockScopesRepository';

@injectable()
export class BlocksScopesService {
  constructor(
    @inject(NoteBlocksService)
    private noteBlocksService: NoteBlocksService,
    @inject(toRemoteName(BlocksScopesRepository))
    private blocksScopesRepo: Remote<BlocksScopesRepository>,
    @inject(NotesStore)
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

          return this.blocksScopesStore.getOrCreateScopes(
            args.map((arg) => ({
              ...arg,
              collapsedBlockIds:
                scopesFromDb[
                  getScopeKey(
                    arg.noteId,
                    arg.scopedBy.$modelType,
                    arg.scopedBy.$modelId,
                    arg.rootBlockViewId,
                  )
                ]?.collapsedBlockIds || [],
            })),
          );
        }),
        distinctUntilChanged((a, b) => isEqual(a, b)),
      );
  }
}
