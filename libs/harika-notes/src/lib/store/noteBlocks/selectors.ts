import { NoteBlocksState, NoteBlockEntity } from './reducer';

export const getNoteBlock = (id: string, state: NoteBlocksState) => {
  return state.byId[id];
};

export const getParentNoteBlock = (id: string, state: NoteBlocksState) => {
  const parentBlockId = getNoteBlock(id, state).parentBlockId;

  if (!parentBlockId) return;

  return getNoteBlock(parentBlockId, state);
};

export const sortBlocks = (blocks: NoteBlockEntity[]) => {
  return blocks.sort((a, b) => a.order - b.order);
};

export const getChildBlocks = (blockId: string, state: NoteBlocksState) => {
  return sortBlocks(
    Object.values(state.byId).filter((bl) => bl.parentBlockId === blockId)
  );
};

export const getTraversedLast = (
  blockId: string,
  state: NoteBlocksState
): NoteBlockEntity => {
  const children = getChildBlocks(blockId, state);

  if (children.length === 0) return getNoteBlock(blockId, state);

  return getTraversedLast(children[children.length - 1].id, state);
};

export const getReverseRight = (blockId: string, state: NoteBlocksState) => {};
