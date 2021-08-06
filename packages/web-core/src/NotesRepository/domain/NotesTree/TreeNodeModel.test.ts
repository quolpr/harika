import { expect } from 'chai';
import { fromSnapshot, setGlobalConfig } from 'mobx-keystone';
import { newTreeModel, NotesTreeModel } from './NotesTreeModel';

let id = 1;

setGlobalConfig({
  modelIdGenerator() {
    return `id-${id++}`;
  },
});

beforeEach(() => {
  id = 1;
});

const initData = () => {
  newTreeModel();

  // treeNode.initializeTree([
  //   { id: '123', title: 'Home' },
  //   { id: '345', title: 'Home/To Buy/Urgent' },
  //   { id: '678', title: 'Work/TODO' },
  // ]);

  const snapshot = {
    rootNodeRef: {
      id: 'id-1',
      $modelId: 'id-2',
      $modelType: 'harika/NotesTree/nodeRef',
    },
    nodesMap: {
      'id-1': {
        title: 'root',
        nodeRefs: [
          {
            id: 'id-4',
            $modelId: 'id-5',
            $modelType: 'harika/NotesTree/nodeRef',
          },
          {
            id: 'id-10',
            $modelId: 'id-11',
            $modelType: 'harika/NotesTree/nodeRef',
          },
        ],
        isExpanded: true,
        $modelId: 'id-1',
        $modelType: 'harika/NotesTree/TreeNodeModel',
      },
      'id-4': {
        title: 'Home',
        nodeRefs: [
          {
            id: 'id-6',
            $modelId: 'id-7',
            $modelType: 'harika/NotesTree/nodeRef',
          },
        ],
        noteId: '123',
        isExpanded: true,
        $modelId: 'id-4',
        $modelType: 'harika/NotesTree/TreeNodeModel',
      },
      'id-6': {
        title: 'To Buy',
        nodeRefs: [
          {
            id: 'id-8',
            $modelId: 'id-9',
            $modelType: 'harika/NotesTree/nodeRef',
          },
        ],
        isExpanded: true,
        $modelId: 'id-6',
        $modelType: 'harika/NotesTree/TreeNodeModel',
      },
      'id-8': {
        title: 'Urgent',
        nodeRefs: [],
        noteId: '345',
        isExpanded: true,
        $modelId: 'id-8',
        $modelType: 'harika/NotesTree/TreeNodeModel',
      },
      'id-10': {
        title: 'Work',
        nodeRefs: [
          {
            id: 'id-12',
            $modelId: 'id-13',
            $modelType: 'harika/NotesTree/nodeRef',
          },
        ],
        isExpanded: true,
        $modelId: 'id-10',
        $modelType: 'harika/NotesTree/TreeNodeModel',
      },
      'id-12': {
        title: 'TODO',
        nodeRefs: [],
        noteId: '678',
        isExpanded: true,
        $modelId: 'id-12',
        $modelType: 'harika/NotesTree/TreeNodeModel',
      },
    },
    isInitialized: true,
    $modelId: 'id-3',
    $modelType: 'harika/NotesTreeModel',
  };

  const tree = fromSnapshot<NotesTreeModel>(snapshot);

  // Home/To Buy/Urgent
  return { tree, testNode: tree.noteIdsMap['345'] };
};

describe('TreeNodeModel', () => {
  describe('path', () => {
    it('works', () => {
      expect(initData().testNode.path.map(({ title }) => title)).to.deep.eq([
        'root',
        'Home',
        'To Buy',
      ]);
    });
  });
  describe('fullTitle', () => {
    it('works', () => {
      expect(initData().testNode.fullTitle).to.eq('Home/To Buy/Urgent');
    });
  });
});
