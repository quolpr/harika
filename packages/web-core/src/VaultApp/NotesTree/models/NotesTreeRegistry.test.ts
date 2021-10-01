import { expect } from 'chai';
import { getSnapshot, setGlobalConfig } from 'mobx-keystone';
import { newTreeModel } from './NotesTreeRegistry';

// TODO: add util to string method, and compare just string tree instaed of full state

let id = 1;

setGlobalConfig({
  modelIdGenerator() {
    return `id-${id++}`;
  },
});

beforeEach(() => {
  id = 1;
});

describe('NotesTreeModel', () => {
  describe('initializeTree', () => {
    it('works', () => {
      const treeNode = newTreeModel();

      treeNode.initializeTree([
        { id: '123', title: 'Home' },
        { id: '234', title: 'Home/To Buy' },
        { id: '345', title: 'Home/To Buy/Urgent' },
        { id: '456', title: 'Home/TODO' },
        { id: '567', title: 'Home/DONE' },
        { id: '678', title: 'Work/TODO' },
      ]);

      expect(getSnapshot(treeNode)).to.deep.equal({
        isInitialized: true,
        rootNodeRef: {
          id: 'id-1',
          $modelId: 'id-2',
          $modelType: 'harika/NotesTree/noteRef',
        },
        nodesMap: {
          'id-1': {
            title: 'root',
            noteId: undefined,
            nodeRefs: [
              {
                id: 'id-4',
                $modelId: 'id-5',
                $modelType: 'harika/NotesTree/noteRef',
              },
              {
                id: 'id-14',
                $modelId: 'id-15',
                $modelType: 'harika/NotesTree/noteRef',
              },
            ],
            isExpanded: false,
            $modelId: 'id-1',
            $modelType: 'harika/NotesTree/NotesTreeNote',
          },
          'id-4': {
            title: 'Home',
            nodeRefs: [
              {
                id: 'id-6',
                $modelId: 'id-7',
                $modelType: 'harika/NotesTree/noteRef',
              },
              {
                id: 'id-10',
                $modelId: 'id-11',
                $modelType: 'harika/NotesTree/noteRef',
              },
              {
                id: 'id-12',
                $modelId: 'id-13',
                $modelType: 'harika/NotesTree/noteRef',
              },
            ],
            noteId: '123',
            $modelId: 'id-4',
            $modelType: 'harika/NotesTree/NotesTreeNote',
            isExpanded: false,
          },
          'id-6': {
            title: 'To Buy',
            nodeRefs: [
              {
                id: 'id-8',
                $modelId: 'id-9',
                $modelType: 'harika/NotesTree/noteRef',
              },
            ],
            noteId: '234',
            $modelId: 'id-6',
            $modelType: 'harika/NotesTree/NotesTreeNote',
            isExpanded: false,
          },
          'id-8': {
            title: 'Urgent',
            nodeRefs: [],
            noteId: '345',
            $modelId: 'id-8',
            $modelType: 'harika/NotesTree/NotesTreeNote',
            isExpanded: false,
          },
          'id-10': {
            title: 'TODO',
            nodeRefs: [],
            noteId: '456',
            $modelId: 'id-10',
            $modelType: 'harika/NotesTree/NotesTreeNote',
            isExpanded: false,
          },
          'id-12': {
            title: 'DONE',
            nodeRefs: [],
            noteId: '567',
            $modelId: 'id-12',
            $modelType: 'harika/NotesTree/NotesTreeNote',
            isExpanded: false,
          },
          'id-14': {
            title: 'Work',
            noteId: undefined,
            nodeRefs: [
              {
                id: 'id-16',
                $modelId: 'id-17',
                $modelType: 'harika/NotesTree/noteRef',
              },
            ],
            $modelId: 'id-14',
            $modelType: 'harika/NotesTree/NotesTreeNote',
            isExpanded: false,
          },
          'id-16': {
            title: 'TODO',
            nodeRefs: [],
            noteId: '678',
            $modelId: 'id-16',
            $modelType: 'harika/NotesTree/NotesTreeNote',
            isExpanded: false,
          },
        },
        $modelId: 'id-3',
        $modelType: 'harika/NotesTree/NotesTreeRegistry',
      });
    });

    describe('on note title change', () => {
      describe('on create', () => {
        it('works', () => {
          const treeNode = newTreeModel();

          treeNode.handleNotesChanges([
            { id: '123', type: 'create', title: 'Home/To Buy' },
          ]);

          expect(getSnapshot(treeNode)).to.deep.eq({
            rootNodeRef: {
              id: 'id-1',
              $modelId: 'id-2',
              $modelType: 'harika/NotesTree/noteRef',
            },
            nodesMap: {
              'id-1': {
                title: 'root',
                nodeRefs: [
                  {
                    id: 'id-4',
                    $modelId: 'id-5',
                    $modelType: 'harika/NotesTree/noteRef',
                  },
                ],
                isExpanded: false,
                noteId: undefined,
                $modelId: 'id-1',
                $modelType: 'harika/NotesTree/NotesTreeNote',
              },
              'id-4': {
                title: 'Home',
                nodeRefs: [
                  {
                    id: 'id-6',
                    $modelId: 'id-7',
                    $modelType: 'harika/NotesTree/noteRef',
                  },
                ],
                isExpanded: false,
                noteId: undefined,
                $modelId: 'id-4',
                $modelType: 'harika/NotesTree/NotesTreeNote',
              },
              'id-6': {
                title: 'To Buy',
                nodeRefs: [],
                noteId: '123',
                isExpanded: false,
                $modelId: 'id-6',
                $modelType: 'harika/NotesTree/NotesTreeNote',
              },
            },
            isInitialized: false,
            $modelId: 'id-3',
            $modelType: 'harika/NotesTree/NotesTreeRegistry',
          });
        });
      });

      describe('on delete', () => {
        it('cleans nodes with empty nodeRefs and without id', () => {
          const treeNode = newTreeModel();

          treeNode.initializeTree([{ id: '234', title: 'Home/To Buy' }]);

          treeNode.handleNotesChanges([{ id: '234', type: 'delete' }]);

          // expect(treeNode.rootNodeRef.current.nodeRefs).to.deep.eq([]);
        });
      });
    });

    // it("doesn't take notes without group", () => {
    //   const treeNode = newTreeModel();

    //   treeNode.initializeTree([{ id: '123', title: 'Home' }]);

    //   expect(getSnapshot(treeNode)).to.deep.equal({
    //     $modelId: 'id-3',
    //     $modelType: 'harika/NotesTreeRegistry',
    //     isInitialized: true,
    //     rootNodeRef: {
    //       id: 'id-1',
    //       $modelId: 'id-2',
    //       $modelType: 'harika/NotesTree/nodeRef',
    //     },
    //     nodesMap: {
    //       'id-1': {
    //         title: 'root',
    //         noteId: undefined,
    //         nodeRefs: [],
    //         $modelId: 'id-1',
    //         $modelType: 'harika/NotesTree/NotesTreeNote',
    //         isExpanded: true,
    //       },

    //     },
    //   });
    // });
  });
});
