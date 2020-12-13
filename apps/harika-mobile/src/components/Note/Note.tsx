import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Note as NoteModel } from '@harika/harika-notes';
import { t } from 'react-native-tailwindcss';
import { TextInput } from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useTable } from '@harika/harika-core';
import { NoteBlock } from '../NoteBlock';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import useUpdate from 'react-use/lib/useUpdate';

export const Note: React.FC<{ note: NoteModel }> = React.memo(({ note }) => {
  const database = useDatabase();
  const update = useUpdate();

  note = useTable(note);
  const noteBlocks = NoteBlockModel.sort(useTable(note.childNoteBlocks) || []);

  const [isEditing, setIsEditing] = useState(false);

  const [editState, setEditState] = useState({
    title: note.title,
    id: note.id,
  });

  useEffect(() => {
    if (!isEditing) {
      setEditState({ title: note.title, id: note.id });
    }
  }, [isEditing, note.id, note.title]);

  useEffect(() => {
    if (editState.id !== note.id) return;
    if (editState.title === note.title) return;

    note.updateTitle(editState.title);
  }, [database, editState.id, editState.title, note]);

  const handleChange = useCallback(
    (text: string) => {
      setEditState({ id: note.id, title: text });
    },
    [note.id]
  );

  return (
    <View>
      <View style={[t.h5]}>
        <TextInput
          onChangeText={handleChange}
          value={editState.title}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
        />
      </View>
      <View style={t.mT2}>
        {noteBlocks.map((noteBlock, i) => (
          <NoteBlock
            onOrderChange={update}
            key={noteBlock.id}
            noteBlock={noteBlock}
            isLast={noteBlocks.length - 1 === i}
          />
        ))}
      </View>
    </View>
  );
});
