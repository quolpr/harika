type IModel = { $modelId: string };

export type ITreeNode<T> = T & {
  parent: ITreeNode<T> | undefined;
  children: ITreeNode<T>[];
  path: ITreeNode<T>[];
  orderPosition: number;
  siblings: ITreeNode<T>[];
  // move(parent: ITreeNode<T>, pos: number | 'start' | 'end'): void;
  // spliceChild(
  //   start: number,
  //   deleteCount?: number,
  //   ...nodes: ITreeNode<T>[]
  // ): void;
  indent: number;
  hasChildren: boolean;
  isRoot: boolean;
  // textContent: string;

  deepLastRightChild: ITreeNode<T>;
  flattenTree: ITreeNode<T>[];
  leftAndRightSibling: [
    left: ITreeNode<T> | undefined,
    right: ITreeNode<T> | undefined,
  ];
  leftAndRight: [
    left: ITreeNode<T> | undefined,
    right: ITreeNode<T> | undefined,
  ];
  nearestRightToParent: ITreeNode<T> | undefined;
  allRightSiblings: ITreeNode<T>[];

  // getStringTree(includeId: boolean, indent: number): string;

  // mergeToLeftAndDelete(): ITreeNode<T> | undefined;
  // handleMerge(from: ITreeNode<T>, to: ITreeNode<T>): void;
};

// for performance optimization
export function orderHashFunc<T extends IModel>(
  node: ITreeNode<T>,
): Record<string, number> {
  const obj: Record<string, number> = {};

  node.children.forEach((model, i) => {
    obj[model.$modelId] = i;
  });

  return obj;
}

export function pathFunc<K extends IModel>(node: ITreeNode<K>): ITreeNode<K>[] {
  let current: ITreeNode<K> | undefined = node.parent;
  const path: ITreeNode<K>[] = [];

  while (current) {
    path.unshift(current);
    current = current.parent;
  }

  return path;
}

export function siblingsFunc<K extends IModel>(
  node: ITreeNode<K>,
): ITreeNode<K>[] {
  const parent = node.parent;

  if (!parent) {
    throw new Error("You can't get sibling of root noteblock");
  }

  return parent.children;
}

export function indentFunc<K extends IModel>(node: ITreeNode<K>) {
  return node.path.length;
}

export function deepLastRightChildFunc<K extends IModel>(node: ITreeNode<K>) {
  if (node.children.length === 0) return node;

  return node.children[node.children.length - 1].deepLastRightChild;
}

export function flattenTreeFunc<K extends IModel>(node: ITreeNode<K>) {
  // optimization required here, but how?
  const blocks: ITreeNode<K>[] = [];

  node.children.forEach((node) => {
    blocks.push(node);
    blocks.push(...node.flattenTree);
  });

  return blocks;
}

export function leftAndRightSiblingFunc<K extends IModel>(
  node: ITreeNode<K>,
): [left: ITreeNode<K> | undefined, right: ITreeNode<K> | undefined] {
  const siblings = node.siblings;

  const index = siblings.findIndex((nb) => node.$modelId === nb.$modelId);

  return [
    siblings.length === 0 ? undefined : siblings[index - 1],
    index + 1 < siblings.length ? siblings[index + 1] : undefined,
  ];
}

export function nearestRightToParentFunc<T extends IModel>(
  node: ITreeNode<T>,
): ITreeNode<T> | undefined {
  if (!node.parent || node.parent.isRoot) return undefined;

  const [, right] = node.parent.leftAndRightSibling;

  if (right) return right;

  return node.parent.nearestRightToParent;
}

export function leftAndRightFunc<T extends IModel>(
  node: ITreeNode<T>,
): [left: ITreeNode<T> | undefined, right: ITreeNode<T> | undefined] {
  let [left, right] = node.leftAndRightSibling;

  if (left) {
    left = left.deepLastRightChild;
  }

  if (!left && node.parent !== undefined && !node.parent.isRoot) {
    left = node.parent;
  }

  const children = node.children;

  if (children.length !== 0 && children[0]) {
    right = children[0];
  }

  if (!right) {
    right = node.nearestRightToParent;
  }

  return [left, right];
}

export function allRightSiblingsFunc<T extends IModel>(node: ITreeNode<T>) {
  const siblings = node.siblings;
  const index = node.orderPosition;

  return siblings.slice(index + 1);
}

// export function getStringTreeFunc<T extends IModel>(
//   node: ITreeNode<T>,
//   includeId: boolean,
//   indent: number,
// ): string {
//   let str = node.isRoot
//     ? ''
//     : `${'  '.repeat(indent)}- ${node.textContent}${
//         includeId ? ` [#${node.nodeId}]` : ''
//       }\n`;

//   node.children.forEach((node) => {
//     str += node.getStringTree(includeId, node.isRoot ? 0 : indent + 1);
//   });

//   return str;
// }
