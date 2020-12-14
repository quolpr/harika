import { NoteBlocksState, NoteBlockEntity } from './reducer';

export const getNoteBlock = (id: string, state: NoteBlocksState) => {
  return state.byId[id];
};

export const getNoteBlocksByIds = (ids: string[], state: NoteBlocksState) => {
  return ids.map((id) => {
    return getNoteBlock(id, state);
  });
};

export const getParentNoteBlock = (id: string, state: NoteBlocksState) => {
  const parentBlockId = getNoteBlock(id, state).parentBlockId;

  if (!parentBlockId) return;

  return getNoteBlock(parentBlockId, state);
};

export const getChildBlocks = (blockId: string, state: NoteBlocksState) => {
  return getNoteBlocksByIds(getNoteBlock(blockId, state).childBlockIds, state);
};

export const getAllSiblings = (blockId: string, state: NoteBlocksState) => {
  const parentBlock = getParentNoteBlock(blockId, state);
  if (!parentBlock) {
    return getNoteBlocksByIds(state.ids, state);
  }

  return getNoteBlocksByIds(parentBlock.childBlockIds, state);
};

export const getLeftAndRightSibling = (
  blockId: string,
  state: NoteBlocksState
): [NoteBlockEntity | undefined, NoteBlockEntity | undefined] => {
  const siblings = getAllSiblings(blockId, state);

  const index = siblings.findIndex((ch) => blockId === ch.id);

  return [siblings[index - 1], siblings[index + 1]];
};

export const getTraversedLast = (
  blockId: string,
  state: NoteBlocksState
): NoteBlockEntity => {
  const children = getChildBlocks(blockId, state);

  if (children.length === 0) return getNoteBlock(blockId, state);

  return getTraversedLast(children[children.length - 1].id, state);
};

export const getReverseRight = (
  blockId: string,
  state: NoteBlocksState
): NoteBlockEntity | undefined => {
  const parent = getParentNoteBlock(blockId, state);

  if (!parent) return undefined;

  const [, right] = getLeftAndRightSibling(blockId, state);

  if (right) return right;

  return getReverseRight(parent.id, state);
};

export const getLeftAndRight = (
  blockId: string,
  state: NoteBlocksState
): [NoteBlockEntity | undefined, NoteBlockEntity | undefined] => {
  let [left, right] = getLeftAndRightSibling(blockId, state);

  if (left) {
    left = getTraversedLast(left.id, state);
  }

  if (!left) {
    left = getParentNoteBlock(blockId, state);
  }

  const children = getChildBlocks(blockId, state);

  if (children[0]) {
    right = children[0];
  }

  if (!right) {
    right = getReverseRight(blockId, state);
  }

  return [left, right];
};

export const getAllRightSiblings = (
  blockId: string,
  state: NoteBlocksState
) => {
  const childBlockIds = getNoteBlock(blockId, state).childBlockIds;
  const index = childBlockIds.indexOf(blockId);

  return getNoteBlocksByIds(childBlockIds.slice(index), state);
};
