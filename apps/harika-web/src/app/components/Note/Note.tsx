import React from 'react';
import withObservables from '@nozbe/with-observables';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import {
  HarikaNotesTableName,
  NoteBlock as NoteBlockModel,
} from '@harika/harika-notes';
import { Note as NoteModel } from '@harika/harika-notes';
import './styles.css';
import { Database } from '@nozbe/watermelondb';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';

type InputProps = { noteId: string };

const NoteBlocksComponent: React.FC<{
  noteBlocks: NoteBlockModel[];
}> = ({ noteBlocks }) => {
  return (
    <>
      {NoteBlockModel.sort(noteBlocks).map((noteBlock) => (
        <NoteBlock key={noteBlock.id} noteBlock={noteBlock} />
      ))}
    </>
  );
};

const NoteBlocks = withObservables(['note'], ({ note }) => ({
  noteBlocks: note.childNoteBlocks,
}))(NoteBlocksComponent);

export const NoteComponent: React.FC<InputProps & { note: NoteModel }> = ({
  note,
  noteId,
}) => {
  console.log(noteId);

  return (
    <div className="note">
      <h2 className="note__header">
        <TextareaAutosize className="note__input" value={note.title} />
      </h2>
      <div className="note__body">
        <NoteBlocks note={note} />
      </div>
    </div>
  );
};

export const Note = withDatabase<InputProps & { database: Database }>(
  withObservables(
    ['noteId'],
    ({ database, noteId }: { database: Database; noteId: string }) => {
      const note = database.collections
        .get<NoteModel>(HarikaNotesTableName.NOTES)
        .findAndObserve(noteId);

      // TODO: check if I can get childNoteBlocks here too
      //

      return {
        note,
      };
    }
  )(NoteComponent as any)
);
