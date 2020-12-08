import React from 'react';
import NoteModel from '../../../model/Note';
import NoteBlockModel from '../../../model/NoteBlock';
import withObservables from '@nozbe/with-observables';
import TextareaAutosize from 'react-textarea-autosize';

import './styles.css';
import { NoteBlock } from '../NoteBlock/NoteBlock';

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
