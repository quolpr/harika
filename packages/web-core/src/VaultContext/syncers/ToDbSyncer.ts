import type { Remote, UnproxyOrClone } from 'comlink';
import { uniq } from 'lodash-es';
import type { Patch, Path } from 'mobx-keystone';
import { Subject } from 'rxjs';
import { buffer, concatMap, debounceTime, tap } from 'rxjs/operators';
import type {
  BaseSyncRepository,
  SqlBlocksViewsRepository,
  SqlNotesBlocksRepository,
  SqlNotesRepository,
} from '../../SqlNotesRepository.worker';
import type { NoteBlockModel } from '../domain/NoteBlockModel';
import type { VaultModel } from '../NotesService';
import { mapNote, mapNoteBlock, mapView } from './toDbDocsConverters';

// TODO: type rootKey
const zipPatches = (selector: (path: Path) => boolean, patches: Patch[]) => {
  const scopedPatches = patches.filter((p) => selector(p.path));

  const toDeleteIds = uniq(
    scopedPatches
      .filter(
        (p) =>
          p.op === 'replace' && p.path[2] === 'isDeleted' && p.value === true,
      )
      .map((p) => p.path[1] as string),
  );

  const toCreateIds = uniq(
    scopedPatches
      .flatMap((p) => {
        if (p.op === 'add' && p.path.length === 2) {
          return p.path[1] as string;
        } else if (
          p.op === 'replace' &&
          p.path.length === 1 &&
          typeof p.value === 'object'
        ) {
          return Object.keys(p.value) as string[];
        } else {
          return undefined;
        }
      })
      .filter((key) => key !== undefined && !toDeleteIds.includes(key)),
  ) as string[];

  const toDeleteAndCreateIds = [...toDeleteIds, ...toCreateIds];

  const toUpdateIds = uniq(
    scopedPatches
      .filter(
        (p) =>
          p.path[1] !== undefined &&
          !toDeleteAndCreateIds.includes(p.path[1] as string),
      )
      .map((p) => p.path[1] as string),
  );

  return {
    toCreateIds,
    toUpdateIds,
    toDeleteIds,
  };
};

// const patches = {
//   patches: [
//     {
//       op: 'add',
//       path: ['notesMap', '85CekeoPoieyk9tkx25Q'],
//       value: {
//         $modelId: '85CekeoPoieyk9tkx25Q',
//         createdAt: 1628489061599,
//         rootBlockId: 'KpSs6ORPj15mXbR7zaS9',
//         dailyNoteDate: 1634158800000,
//         title: '14 Oct 2021',
//         isDeleted: false,
//         $modelType: 'harika/NoteModel',
//       },
//     },
//     {
//       op: 'add',
//       path: ['blocksTreeHoldersMap', '85CekeoPoieyk9tkx25Q'],
//       value: {
//         blocksMap: {
//           KpSs6ORPj15mXbR7zaS9: {
//             $modelId: 'KpSs6ORPj15mXbR7zaS9',
//             createdAt: 1628489061598,
//             noteId: '85CekeoPoieyk9tkx25Q',
//             noteBlockRefs: [],
//             content: {
//               value: '',
//               $modelId: '69-cbfqhhPueUIdU7_nNMN5j',
//               $modelType: 'harika/ContentManagerModel',
//             },
//             linkedNoteIds: [],
//             isDeleted: false,
//             $modelType: 'harika/NoteBlockModel',
//           },
//         },
//         noteId: '85CekeoPoieyk9tkx25Q',
//         $modelId: '6a-cbfqhhPueUIdU7_nNMN5j',
//         $modelType: 'harika/BlocksTreeHolder',
//       },
//     },
//     {
//       op: 'add',
//       path: [
//         'blocksTreeHoldersMap',
//         '85CekeoPoieyk9tkx25Q',
//         'blocksMap',
//         'U5SDzRMWUlHWcwhfMV6F',
//       ],
//       value: {
//         $modelId: 'U5SDzRMWUlHWcwhfMV6F',
//         createdAt: 1628489061602,
//         noteId: '85CekeoPoieyk9tkx25Q',
//         noteBlockRefs: [],
//         linkedNoteIds: [],
//         content: {
//           value: '',
//           $modelId: '6b-cbfqhhPueUIdU7_nNMN5j',
//           $modelType: 'harika/ContentManagerModel',
//         },
//         isDeleted: false,
//         $modelType: 'harika/NoteBlockModel',
//       },
//     },
//     {
//       op: 'add',
//       path: [
//         'blocksTreeHoldersMap',
//         '85CekeoPoieyk9tkx25Q',
//         'blocksMap',
//         'KpSs6ORPj15mXbR7zaS9',
//         'noteBlockRefs',
//         0,
//       ],
//       value: {
//         id: 'U5SDzRMWUlHWcwhfMV6F',
//         $modelId: '6c-cbfqhhPueUIdU7_nNMN5j',
//         $modelType: 'harika/NoteBlockRef',
//       },
//     },
//     {
//       op: 'add',
//       path: [
//         'ui',
//         'blocksViewsMap',
//         '85CekeoPoieyk9tkx25Q-harika/NoteModel-85CekeoPoieyk9tkx25Q',
//       ],
//       value: {
//         $modelId: '85CekeoPoieyk9tkx25Q-harika/NoteModel-85CekeoPoieyk9tkx25Q',
//         blockTreeHolderRef: {
//           id: '85CekeoPoieyk9tkx25Q',
//           $modelId: '6d-cbfqhhPueUIdU7_nNMN5j',
//           $modelType: 'harika/BlocksTreeHolderRef',
//         },
//         scopedModelId: '85CekeoPoieyk9tkx25Q',
//         scopedModelType: 'harika/NoteModel',
//         collapsedBlockIds: [],
//         $modelType: 'harika/BlocksViewModel',
//       },
//     },
//   ],
// };
const getBlocksPatches = (
  getNoteBlock: (id: string) => NoteBlockModel | undefined,
  patches: Patch[],
) => {
  const toCreateIds = new Set<string>();
  const toUpdateIds = new Set<string>();
  const toDeleteIds = new Set<string>();

  patches.forEach((patch) => {
    if (
      patch.path.length === 2 &&
      patch.path[0] === 'blocksTreeHoldersMap' &&
      patch.op === 'add'
    ) {
      Object.keys(patch.value.blocksMap).forEach((v) => {
        toCreateIds.add(v);
      });
    } else if (
      patch.path.length >= 4 &&
      patch.path[0] === 'blocksTreeHoldersMap' &&
      patch.path[2] === 'blocksMap'
    ) {
      const id = patch.path[3] as string;

      if (patch.op === 'add' && patch.path.length === 4) {
        toCreateIds.add(id);
      } else {
        const noteBlock = getNoteBlock(id);

        if (!noteBlock || noteBlock.isDeleted) {
          toDeleteIds.add(id);
        } else {
          toUpdateIds.add(id);
        }
      }
    } else if (patch.path[0] === 'blocksTreeHoldersMap') {
      console.error(patch, 'Unknown patch');
    }
  });

  return {
    toCreateIds: Array.from(toCreateIds).filter((id) => !toDeleteIds.has(id)),
    toUpdateIds: Array.from(toUpdateIds).filter(
      (id) => !toCreateIds.has(id) && !toDeleteIds.has(id),
    ),
    toDeleteIds: Array.from(toDeleteIds),
  };
};

export class ToDbSyncer {
  patchesSubject: Subject<Patch>;

  constructor(
    private notesRepository: Remote<SqlNotesRepository>,
    private notesBlocksRepository: Remote<SqlNotesBlocksRepository>,
    private blocksViewsRepository: Remote<SqlBlocksViewsRepository>,
    private windowId: string,
    private vault: VaultModel,
    onPatchesApplied?: () => void,
  ) {
    this.patchesSubject = new Subject<Patch>();

    this.patchesSubject
      .pipe(
        buffer(this.patchesSubject.pipe(debounceTime(400))),
        concatMap((patches) => this.applyPatches(patches)),
        tap(() => onPatchesApplied?.()),
      )
      .subscribe();
  }

  handlePatch = (patches: Patch[]) => {
    patches.forEach((patch) => {
      this.patchesSubject.next(patch);
    });
  };

  private applyPatches = async (patches: Patch[]) => {
    patches = patches.filter(
      ({ path }) =>
        ['blocksTreeHoldersMap', 'notesMap'].includes(path[0] as string) ||
        (path[0] === 'ui' && path[1] === 'blocksViewsMap'),
    );

    if (patches.length === 0) return;

    const blocksResult = getBlocksPatches(
      (id) => this.vault.getNoteBlock(id),
      patches,
    );

    const noteResult = zipPatches((p) => p[0] === 'notesMap', patches);
    const viewToUpdateIds = patches
      .map((p) =>
        p.path.length > 2 &&
        p.path[0] === 'ui' &&
        p.path[1] === 'blocksViewsMap'
          ? p.path[2]
          : undefined,
      )
      .filter((id) => id !== undefined) as string[];

    console.debug(
      'Applying patches from mobx',
      JSON.stringify({ blocksResult, noteResult, viewToUpdateIds }, null, 2),
    );

    await this.applier(noteResult, this.notesRepository, (id) =>
      mapNote(this.vault.notesMap[id]),
    );

    await this.applier(blocksResult, this.notesBlocksRepository, (id) =>
      mapNoteBlock(this.vault.getNoteBlock(id)!),
    );

    await this.blocksViewsRepository.bulkCreateOrUpdate(
      viewToUpdateIds.map((id) => mapView(this.vault.ui.blocksViewsMap[id])),
      {
        shouldRecordChange: true,
        source: 'inDomainChanges' as const,
      },
    );
  };

  private applier = <T extends Record<string, unknown> & { id: string }>(
    result: {
      toCreateIds: string[];
      toUpdateIds: string[];
      toDeleteIds: string[];
    },
    repo: Remote<BaseSyncRepository<T, any>>,
    mapper: (id: string) => T,
  ) => {
    const ctx = {
      shouldRecordChange: true,
      source: 'inDomainChanges' as const,
    };

    return Promise.all([
      result.toCreateIds.length > 0
        ? repo.bulkCreate(
            result.toCreateIds.map((id) => mapper(id)),
            ctx,
          )
        : null,
      result.toUpdateIds.length > 0
        ? repo.bulkUpdate(
            result.toUpdateIds.map((id) => mapper(id)),
            ctx,
          )
        : null,
      result.toDeleteIds.length > 0
        ? repo.bulkDelete(result.toDeleteIds, ctx)
        : null,
    ]);
  };
}
