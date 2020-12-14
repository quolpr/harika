import { createAction, createReducer } from '@reduxjs/toolkit';

export type NoteBlockEntity = {
  id: string;
  noteId: string;
  parentBlockId: string | undefined;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  childBlockIds: string[];
};

const mergeToLeftAndDelete = createAction<number>(
  'noteBlocks/mergeToLeftAndDelete'
);

export type NoteBlocksState = {
  ids: string[];
  currentNoteId: string;
  byId: { [id: string]: NoteBlockEntity };
};

export default createReducer<{ [id: string]: NoteBlockEntity }>({}, (builder) =>
  builder
    .addCase(increment, (state, action) => {
      // action is inferred correctly here
    })
    .addCase(decrement, (state, action) => {
      // this would error out
    })
);
