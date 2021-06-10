import { DatabaseChangeType, IDatabaseChange } from '@harika/common';
import { ConflictsResolverService } from './conflictsResolver.service';

describe('ConflictsResolverService', () => {
  let service: ConflictsResolverService;

  beforeAll(() => {
    service = new ConflictsResolverService();
  });

  describe('#resolve', () => {
    describe('noteBlocks content conflict resolving', () => {
      it('resolves noteBlockIds conflict', () => {
        const clientChanges: IDatabaseChange[] = [
          {
            type: DatabaseChangeType.Update,
            table: 'noteBlocks',
            key: 'hQn4Rzd2XNgDGvVBC9qf',
            mods: { 'noteBlockIds.0': '123', 'noteBlockIds.1': '456' },
            source: 'ef41d3c2-9d20-4f3b-9d78-94d1ee5e82a1',
            obj: null,
          },
        ];

        const serverChanges: Record<string, IDatabaseChange> = {
          hQn4Rzd2XNgDGvVBC9qf: {
            type: DatabaseChangeType.Update,
            table: 'noteBlocks',
            key: 'hQn4Rzd2XNgDGvVBC9qf',
            mods: { 'noteBlockIds.0': '789', 'noteBlockIds.1': '456' },
            source: 'ef41d3c2-9d20-4f3b-9d78-94d1ee5e82a1',
            obj: null,
          },
        };

        expect(service.resolve(clientChanges, serverChanges)).toEqual([
          {
            type: DatabaseChangeType.Update,
            table: 'noteBlocks',
            key: 'hQn4Rzd2XNgDGvVBC9qf',
            mods: {
              'noteBlockIds.0': '789',
              'noteBlockIds.1': '456',
              'noteBlockIds.2': '123',
              'noteBlockIds.3': '456',
            },
            source: 'ef41d3c2-9d20-4f3b-9d78-94d1ee5e82a1',
            obj: null,
          },
        ]);
      });

      it('resolves block content conflict', () => {
        const clientChanges: IDatabaseChange[] = [
          {
            type: DatabaseChangeType.Update,
            table: 'noteBlocks',
            key: '1URGz9q1xhYld9MVaBhy',
            mods: { content: 'kek' },
            source: '123',
          },
        ];

        const serverChanges: Record<string, IDatabaseChange> = {
          hQn4Rzd2XNgDGvVBC9qf: {
            type: DatabaseChangeType.Update,
            table: 'noteBlocks',
            key: '1URGz9q1xhYld9MVaBhy',
            mods: { context: 'puk' },
            source: '234',
          },
        };
      });
    });
  });
});
