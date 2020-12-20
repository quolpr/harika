import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { t } from 'react-native-tailwindcss';
import { TextInput } from 'react-native';
import { NoteBlock } from '../NoteBlock';
import { NoteBlockModel, NoteModel } from '@harika/harika-notes';
import { observer } from 'mobx-react-lite';
import { Ref } from 'mobx-keystone';

const NoteChildren = observer(
  ({ childBlockRefs }: { childBlockRefs: Ref<NoteBlockModel>[] }) => {
    return (
      <>
        {childBlockRefs.map(({ current: noteBlock }, i) => (
          <NoteBlock
            key={noteBlock.$modelId}
            noteBlock={noteBlock}
            isLast={childBlockRefs.length - 1 === i}
            isFirst={childBlockRefs.length === 0}
          />
        ))}
      </>
    );
  }
);

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

  return (
    <View style={[t.pT2, t.mB5]}>
      <View style={[t.h5]}>
        <TextInput
          onChangeText={handleChange}
          value={editState.title}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          style={[t.text2xl, t.fontBold]}
        />
      </View>
      <View style={t.mT5}>
        <NoteChildren childBlockRefs={note.childBlockRefs} />
      </View>
    </View>
  );
});
