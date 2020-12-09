import React from 'react';
import withObservables from '@nozbe/with-observables';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlock } from '../NoteBlock/NoteBlock';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import { Note as NoteModel } from '@harika/harika-notes';
import './styles.css';

type InputProps = { note: NoteModel };

export const NoteComponent = ({
  note,
  noteBlocks,
}: InputProps & { noteBlocks: NoteBlockModel[] }) => {
  return (
    <div className="note">
      <h2 className="note__header">
        <TextareaAutosize className="note__input" defaultValue={note.title} />
      </h2>
      <div className="note__body">
        {noteBlocks
          .sort((a, b) => a.order - b.order)
          .map((noteBlock) => (
            <NoteBlock key={noteBlock.id} noteBlock={noteBlock} />
          ))}
      </div>
    </div>
  );
};

const enhance = withObservables(['note'], ({ note }) => ({
  note: note.observe(),
  noteBlocks: note.childNoteBlocks.observe(),
}));

export const Note = enhance(NoteComponent) as React.FC<InputProps>;
