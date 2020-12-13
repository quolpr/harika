import { createAction, createReducer } from '@reduxjs/toolkit';

export type NoteBlockEntity = {
  id: string;
  noteId: string;
  parentBlockId: string | undefined;
  content: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

const increment = createAction<number, 'increment'>('increment');
const decrement = createAction<number, 'decrement'>('decrement');

export type NoteBlocksState = {
  byId: { [id: string]: NoteBlockEntity };
  currentNoteId: string;
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
