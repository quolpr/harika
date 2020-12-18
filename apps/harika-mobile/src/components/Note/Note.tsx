import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { t } from 'react-native-tailwindcss';
import { TextInput } from 'react-native';
import { NoteBlock } from '../NoteBlock';
import { NoteModel } from '@harika/harika-notes';
import { observer } from 'mobx-react-lite';

export const Note: React.FC<{ note: NoteModel }> = observer(({ note }) => {
  const [isEditing, setIsEditing] = useState(false);

  const [editState, setEditState] = useState({
    title: note.title,
    id: note.$modelId,
  });

  useEffect(() => {
    if (!isEditing) {
      setEditState({ title: note.title, id: note.$modelId });
    }
  }, [isEditing, note.$modelId, note.title]);

  useEffect(() => {
    if (editState.id !== note.$modelId) return;
    if (editState.title === note.title) return;

    note.updateTitle(editState.title);
  }, [editState.id, editState.title, note]);

  const handleChange = useCallback(
    (text: string) => {
      setEditState({ id: note.$modelId, title: text });
    },
    [note.$modelId]
  );

  console.log(note.childBlockRefs);

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
        {note.childBlockRefs.map(({ current: noteBlock }, i) => (
          <NoteBlock
            key={noteBlock.$modelId}
            noteBlock={noteBlock}
            isLast={note.childBlockRefs.length - 1 === i}
          />
        ))}
      </View>
    </View>
  );
});
