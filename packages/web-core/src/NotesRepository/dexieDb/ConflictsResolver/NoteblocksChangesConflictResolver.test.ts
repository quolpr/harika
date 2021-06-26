import { expect } from '@esm-bundle/chai';
import {
  DatabaseChangeType,
  INoteBlockChangeEvent,
  NoteBlockDocType,
} from '@harika/common';
import { NoteblocksChangesConflictResolver } from './NoteblocksChangesConflictResolver';

const updateChange = (key: string, mods: object): INoteBlockChangeEvent => {
  return {
    table: 'noteBlocks',
    type: DatabaseChangeType.Update,
    mods: mods,
    key,
    source: 'source',
  };
};

const deleteChange = (
  key: string,
  obj: NoteBlockDocType,
): INoteBlockChangeEvent => {
  return {
    table: 'noteBlocks',
    type: DatabaseChangeType.Delete,
    key,
    source: 'source',
    obj,
  };
};

const createChange = (
  key: string,
  obj: NoteBlockDocType,
): INoteBlockChangeEvent => {
  return {
    table: 'noteBlocks',
    type: DatabaseChangeType.Create,
    key,
    source: 'source',
    obj,
  };
};

const resolver = new NoteblocksChangesConflictResolver();

describe('NoteblocksChangesConflictResolver', () => {
  describe('resolveConflicts', () => {
    describe('first - handle all update <-> update', () => {
      describe('first stage', () => {
        context('when noteBlockIds conflicted', () => {
          it('merge them', () => {
            const clientChanges: INoteBlockChangeEvent[] = [
              updateChange('111', {
                'noteBlockIds.333': 0,
                'noteBlockIds.444': 1,
              }),
            ];

            const serverChanges: INoteBlockChangeEvent[] = [
              updateChange('111', {
                'noteBlockIds.555': 1,
              }),
            ];

            expect(
              resolver.resolveConflicts(clientChanges, serverChanges).changes,
            ).to.deep.eq([
              updateChange('111', {
                'noteBlockIds.333': 0,
                'noteBlockIds.444': 1,
                'noteBlockIds.555': 1,
              }),
            ]);
          });

          it('merge delete them', () => {
            const clientChanges: INoteBlockChangeEvent[] = [
              updateChange('111', {
                'noteBlockIds.333': 0,
                'noteBlockIds.444': null,
                'noteBlockIds.555': 1,
              }),
            ];

            const serverChanges: INoteBlockChangeEvent[] = [
              updateChange('111', {
                'noteBlockIds.333': null,
                'noteBlockIds.666': null,
              }),
            ];

            expect(
              resolver.resolveConflicts(clientChanges, serverChanges).changes,
            ).to.deep.eq([
              updateChange('111', {
                'noteBlockIds.333': null,
                'noteBlockIds.444': null,
                'noteBlockIds.555': 1,
                'noteBlockIds.666': null,
              }),
            ]);
          });
        });

        context('when linkedNoteIds conflicted', () => {
          it('uniq merge them', () => {
            const clientChanges: INoteBlockChangeEvent[] = [
              updateChange('123', {
                'linkedNoteIds.111': true,
                'linkedNoteIds.345': null,
              }),
            ];
            const serverChanges: INoteBlockChangeEvent[] = [
              updateChange('123', {
                'linkedNoteIds.111': true,
                'linkedNoteIds.345': true,
                'linkedNoteIds.567': true,
              }),
            ];

            expect(
              resolver.resolveConflicts(clientChanges, serverChanges).changes,
            ).to.deep.eq([
              updateChange('123', {
                'linkedNoteIds.111': true,
                'linkedNoteIds.345': true,
                'linkedNoteIds.567': true,
              }),
            ]);
          });
        });

        context('when content conflicted', () => {
          it('merges them', () => {
            const clientChanges: INoteBlockChangeEvent[] = [
              updateChange('123', {
                content: '123',
              }),
            ];
            const serverChanges: INoteBlockChangeEvent[] = [
              updateChange('123', {
                content: '456',
              }),
            ];

            expect(
              resolver.resolveConflicts(clientChanges, serverChanges).changes,
            ).to.deep.eq([
              updateChange('123', {
                content: '123\n===\n456',
              }),
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
            noteBlockIdsMap: { '111': 0 },
            linkedNoteIdsMap: { '222': true },
            content: 'test',
            createdAt: 0,
          }),
        ];
        const serverChanges: INoteBlockChangeEvent[] = [
          updateChange('123', {
            content: 'test2',
          }),
        ];

        expect(
          resolver.resolveConflicts(clientChanges, serverChanges).changes,
        ).to.deep.eq([
          createChange('123', {
            id: '123',
            noteId: '555',
            noteBlockIdsMap: { '111': 0 },
            linkedNoteIdsMap: { '222': true },
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
          noteBlockIdsMap: { '111': 0 },
          linkedNoteIdsMap: { '222': true },
          content: 'test',
          createdAt: 0,
        }),
      ];
      const serverChanges: INoteBlockChangeEvent[] = [
        deleteChange('123', {
          id: '123',
          noteId: '555',
          noteBlockIdsMap: { '111': 0 },
          linkedNoteIdsMap: { '222': true },
          content: 'test',
          createdAt: 0,
        }),
      ];

      expect(
        resolver.resolveConflicts(clientChanges, serverChanges).changes,
      ).to.deep.eq([clientChanges[0]]);
    });

    it('returns touched noteBlock ids', () => {});
  });
});
