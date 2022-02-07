type IModel = { $modelId: string };

type ModelForPath<K> = K & { parent: ModelForPath<K> | undefined };
export function pathFunc<K extends IModel>(
  node: ModelForPath<K>,
): ModelForPath<K>[] {
  let current: ModelForPath<K> | undefined = node.parent;
  const path: ModelForPath<K>[] = [];

  while (current) {
    path.unshift(current);
    current = current.parent;
  }

  return path;
}

type ModelForFlatten<K> = K & {
  children: ModelForFlatten<K>[];
  flattenTree: ModelForFlatten<K>[];
};
export function flattenTreeFunc<K extends IModel>(node: ModelForFlatten<K>) {
  // optimization required here, but how?
  const blocks: ModelForFlatten<K>[] = [];

  node.children.forEach((node) => {
    blocks.push(node);
    blocks.push(...node.flattenTree);
  });

  return blocks;
}

type ModelForDeepLastRightChild<K> = K & {
  children: ModelForDeepLastRightChild<K>[];
  deepLastRightChild: ModelForDeepLastRightChild<K> | undefined;
};
export function deepLastRightChildFunc<K extends IModel>(
  node: ModelForDeepLastRightChild<K>,
) {
  if (node.children.length === 0) return node;

  return node.children[node.children.length - 1].deepLastRightChild;
}

type ModelForLeftAndRightSibling<K> = K & {
  siblings: ModelForLeftAndRightSibling<K>[];
};
export function leftAndRightSiblingFunc<K extends IModel>(
  node: ModelForLeftAndRightSibling<K>,
): [
  left: ModelForLeftAndRightSibling<K> | undefined,
  right: ModelForLeftAndRightSibling<K> | undefined,
] {
  const siblings = node.siblings;

  const index = siblings.findIndex((nb) => node.$modelId === nb.$modelId);

  return [
    siblings.length === 0 ? undefined : siblings[index - 1],
    index + 1 < siblings.length ? siblings[index + 1] : undefined,
  ];
}

type ModelForNearestRightToParent<K> = K & {
  parent: ModelForNearestRightToParent<K> | undefined;
  leftAndRightSibling: [
    ModelForNearestRightToParent<K> | undefined,
    ModelForNearestRightToParent<K> | undefined,
  ];
  isRoot: boolean;
  nearestRightToParent: ModelForNearestRightToParent<K> | undefined;
};
export function nearestRightToParentFunc<T extends IModel>(
  node: ModelForNearestRightToParent<T>,
): ModelForNearestRightToParent<T> | undefined {
  if (!node.parent || node.parent.isRoot) return undefined;

  const [, right] = node.parent.leftAndRightSibling;

  if (right) return right;

  return node.parent.nearestRightToParent;
}

type ModelForLeftAndRight<K> = K & {
  parent: ModelForLeftAndRight<K> | undefined;
  leftAndRightSibling: [
    ModelForLeftAndRight<K> | undefined,
    ModelForLeftAndRight<K> | undefined,
  ];
  deepLastRightChild: ModelForLeftAndRight<K> | undefined;
  isRoot: boolean;
  children: ModelForLeftAndRight<K>[];
  nearestRightToParent: ModelForLeftAndRight<K> | undefined;
};
export function leftAndRightFunc<T extends IModel>(
  node: ModelForLeftAndRight<T>,
): [
  left: ModelForLeftAndRight<T> | undefined,
  right: ModelForLeftAndRight<T> | undefined,
] {
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

type ModelForStringTree<K> = K & {
  $modelId: string;
  children: ModelForStringTree<K>[];
  toString(): string;
  getStringTree(includeId: boolean, indent: number): string;
  isRoot: boolean;
};
export function getStringTreeFunc<T extends IModel>(
  node: ModelForStringTree<T>,
  includeId: boolean,
  indent: number,
) {
  let str = node.isRoot
    ? ''
    : `${'  '.repeat(indent)}- ${node.toString()}${
        includeId ? ` [#${node.$modelId}]` : ''
      }\n`;

  node.children.forEach((node) => {
    str += node.getStringTree(includeId, node.isRoot ? 0 : indent + 1);
  });

  return str;
}
