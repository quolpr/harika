import { expect } from '@esm-bundle/chai';
import { DatabaseChangeType, VaultDbTables } from '../../../dexieTypes';
import type { NoteBlockDocType } from '../../../dexieTypes';
import type { INoteBlockChangeEvent } from '../../../dexieTypes';
import { NoteblocksChangesApplier } from './NoteblocksChangesApplier';

const updateChange = (
  key: string,
  from: object,
  to: object,
): INoteBlockChangeEvent => {
  return {
    id: '123',
    table: VaultDbTables.NoteBlocks,
    type: DatabaseChangeType.Update,
    from,
    to,
    key,
  };
};

const deleteChange = (
  key: string,
  obj: NoteBlockDocType,
): INoteBlockChangeEvent => {
  return {
    id: '123',
    table: VaultDbTables.NoteBlocks,
    type: DatabaseChangeType.Delete,
    key,
    obj,
  };
};

const createChange = (
  key: string,
  obj: NoteBlockDocType,
): INoteBlockChangeEvent => {
  return {
    id: '123',
    table: VaultDbTables.NoteBlocks,
    type: DatabaseChangeType.Create,
    key,
    obj,
  };
};

const resolver = new NoteblocksChangesApplier(() => '123');

describe('NoteblocksChangesConflictResolver', () => {
  describe('resolveConflicts', () => {
    describe('first - handle all update <-> update', () => {
      describe('first stage', () => {
        context('when noteBlockIds conflicted', () => {
          it('merge them', () => {
            const clientChanges: INoteBlockChangeEvent[] = [
              updateChange(
                '111',
                {
                  noteBlockIds: [],
                },
                {
                  noteBlockIds: ['333', '444'],
                },
              ),
            ];

            const serverChanges: INoteBlockChangeEvent[] = [
              updateChange(
                '111',

                {
                  noteBlockIds: [],
                },
                {
                  noteBlockIds: ['555'],
                },
              ),
            ];

            expect(
              resolver.resolveConflicts(clientChanges, serverChanges)
                .conflictedChanges,
            ).to.deep.eq([
              updateChange(
                '111',
                {
                  noteBlockIds: [],
                },
                {
                  noteBlockIds: ['333', '444', '555'],
                },
              ),
            ]);
          });

          it('merge delete them', () => {
            const clientChanges: INoteBlockChangeEvent[] = [
              updateChange(
                '111',
                {
                  noteBlockIds: ['333', '444', '555'],
                },
                {
                  noteBlockIds: ['333', '777'],
                },
              ),
            ];

            const serverChanges: INoteBlockChangeEvent[] = [
              updateChange(
                '111',
                {
                  noteBlockIds: ['333', '444', '555'],
                },
                {
                  noteBlockIds: [],
                },
              ),
            ];

            expect(
              resolver.resolveConflicts(clientChanges, serverChanges)
                .conflictedChanges,
            ).to.deep.eq([
              updateChange(
                '111',
                {
                  noteBlockIds: ['333', '444', '555'],
                },
                {
                  noteBlockIds: ['777'],
                },
              ),
            ]);
          });
        });

        context('when linkedNoteIds conflicted', () => {
          it('uniq merge them', () => {
            const clientChanges: INoteBlockChangeEvent[] = [
              updateChange(
                '123',
                {
                  noteBlockIds: [],
                },
                {
                  noteBlockIds: ['111', '345'],
                },
              ),
            ];
            const serverChanges: INoteBlockChangeEvent[] = [
              updateChange(
                '123',

                {
                  noteBlockIds: [],
                },
                {
                  noteBlockIds: ['111', '345', '567'],
                },
              ),
            ];

            expect(
              resolver.resolveConflicts(clientChanges, serverChanges)
                .conflictedChanges,
            ).to.deep.eq([
              updateChange(
                '123',
                {
                  noteBlockIds: [],
                },
                {
                  noteBlockIds: ['111', '345', '567'],
                },
              ),
            ]);
          });
        });

        context('when content conflicted', () => {
          it('merges them', () => {
            const clientChanges: INoteBlockChangeEvent[] = [
              updateChange(
                '123',
                { content: '' },
                {
                  content: '123',
                },
              ),
            ];
            const serverChanges: INoteBlockChangeEvent[] = [
              updateChange(
                '123',
                { content: '' },
                {
                  content: '456',
                },
              ),
            ];

            expect(
              resolver.resolveConflicts(clientChanges, serverChanges)
                .conflictedChanges,
            ).to.deep.eq([
              updateChange(
                '123',
                { content: '' },
                {
                  content: '123\n===\n456',
                },
              ),
            ]);
          });
        });
      });

      describe('third stage', () => {
        context('when noteId conflicted', () => {
          // TODO need smarter logic. It doesn't handle case when child block was created it older version of noteBlock and has staled noteId
          it('tries to find what is the new noteId based on noteBlockIds', () => {});

          context('when not found', () => {
            it('returns as conflicted block', () => {});
          });
        });
      });
    });

    describe('second - handle update <-> delete', () => {
      it('restores deleted version and applies updates with update <-> update resolution', () => {
        const clientChanges: INoteBlockChangeEvent[] = [
          deleteChange('123', {
            id: '123',
            noteId: '555',
            noteBlockIds: ['111'],
            linkedNoteIds: ['222'],
            content: 'test',
            createdAt: 0,
          }),
        ];
        const serverChanges: INoteBlockChangeEvent[] = [
          updateChange(
            '123',
            { content: '' },
            {
              content: 'test2',
            },
          ),
        ];

        expect(
          resolver.resolveConflicts(clientChanges, serverChanges)
            .conflictedChanges,
        ).to.deep.eq([
          createChange('123', {
            id: '123',
            noteId: '555',
            noteBlockIds: ['111'],
            linkedNoteIds: ['222'],
            content: 'test2',
            createdAt: 0,
          }),
        ]);
      });

      // context('when was deleted on client, but was moved on server', () => {
      //   it('keeps position as on server', () => {
      //     const clientChanges: INoteBlockChangeEvent[] = [
      //       updateChange('000', {
      //         'linkedNoteIds.123': null,
      //       }),
      //       deleteChange('123', {
      //         id: '123',
      //         noteId: '555',
      //         noteBlockIds: { '111': 0 },
      //         linkedNoteIds: { '222': true },
      //         content: 'test',
      //         createdAt: 0,
      //       }),
      //     ];
      //     const serverChanges: INoteBlockChangeEvent[] = [
      //       updateChange('123', {
      //         content: 'test2',
      //       }),
      //     ];

      //     expect(
      //       resolver.resolveConflicts(clientChanges, serverChanges).changes,
      //     ).to.deep.eq([
      //       createChange('123', {
      //         id: '123',
      //         noteId: '555',
      //         noteBlockIds: { '111': 0 },
      //         linkedNoteIds: { '222': true },
      //         content: 'test2',
      //         createdAt: 0,
      //       }),
      //     ]);
      //   });
      // });

      // context('when was deleted on client without any moving on server', () => {
      //   it('restores position in parent block', () => {});
      // });
    });

    describe('third - handle deletes', () => {
      const clientChanges: INoteBlockChangeEvent[] = [
        deleteChange('123', {
          id: '123',
          noteId: '555',
          noteBlockIds: ['111'],
          linkedNoteIds: ['222'],
          content: 'test',
          createdAt: 0,
        }),
      ];
      const serverChanges: INoteBlockChangeEvent[] = [
        deleteChange('123', {
          id: '123',
          noteId: '555',
          noteBlockIds: ['111'],
          linkedNoteIds: ['222'],
          content: 'test',
          createdAt: 0,
        }),
      ];

      expect(
        resolver.resolveConflicts(clientChanges, serverChanges)
          .conflictedChanges,
      ).to.deep.eq([clientChanges[0]]);
    });

    it('returns touched noteBlock ids', () => {});
  });
});
