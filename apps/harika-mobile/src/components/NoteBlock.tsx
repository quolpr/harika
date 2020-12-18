import { CurrentFocusedBlockContext } from '@harika/harika-core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { t } from 'react-native-tailwindcss';
import { TextInput, View, StyleSheet } from 'react-native';
import { NoteBlockModel } from '@harika/harika-notes';
import { observer } from 'mobx-react-lite';

const styles = StyleSheet.create({
  main: { ...t.flex, ...t.pT1, ...t.pL2 },
  body: { ...t.flex, ...t.flexRow },
  dot: {
    ...t.selfStart,
    ...t.roundedFull,
    ...t.bgGreen500,
    ...t.w1,
    ...t.h1,
    ...t.mR1,
    ...t._mLPx,
    marginTop: 5,
  },
  input: {
    ...t.hFull,
    ...t.flex1,
    ...t.pT0,
  },
  childBlocks: {
    ...t.borderL,
    ...t.borderGreen500,
  },
});

export const NoteBlock = observer(
  ({ noteBlock, isLast }: { noteBlock: NoteBlockModel; isLast: boolean }) => {
    const inputRef = useRef<TextInput | null>(null);

    const [noteBlockContent, setNoteBlockContent] = useState({
      content: noteBlock.content,
      id: noteBlock.$modelId,
    });

    const setFocusedBlock = useContextSelector(
      CurrentFocusedBlockContext,
      ([, setEditState]) => setEditState
    );
    const isEditing = useContextSelector(
      CurrentFocusedBlockContext,
      ([editState]) => editState?.noteBlock?.$modelId === noteBlock.$modelId
    );

    useEffect(() => {
      if (!isEditing) {
        setNoteBlockContent({
          content: noteBlock.content,
          id: noteBlock.$modelId,
        });
      }
    }, [isEditing, noteBlock.$modelId, noteBlock.content]);

    useEffect(() => {
      if (!inputRef.current) return;

      if (isEditing && !inputRef.current.isFocused()) {
        inputRef.current.focus();
      }
    }, [isEditing]);

    const handleFocus = useCallback(() => {
      setFocusedBlock({ noteBlock: noteBlock });
    }, [noteBlock, setFocusedBlock]);

    useEffect(() => {
      if (noteBlock.$modelId !== noteBlockContent.id) return;
      if (noteBlock.content === noteBlockContent.content) return;

      noteBlock.updateContent(noteBlockContent.content);
    }, [noteBlock, noteBlockContent.content, noteBlockContent.id]);

    const handleChange = useCallback(
      (value: string) => {
        setNoteBlockContent({ content: value, id: noteBlock.$modelId });
      },
      [noteBlock.$modelId]
    );

    return (
      <View style={[styles.main, isLast && t.pB0]}>
        <View style={styles.body}>
          <View style={styles.dot} />
          <TextInput
            multiline={true}
            numberOfLines={1}
            style={styles.input}
            onFocus={handleFocus}
            value={noteBlockContent.content}
            onChangeText={handleChange}
            ref={inputRef}
          />
        </View>
        {noteBlock.childBlockRefs.length !== 0 && (
          <View style={styles.childBlocks}>
            {noteBlock.childBlockRefs.map(({ current: childNoteBlock }, i) => (
              <NoteBlock
                key={childNoteBlock.$modelId}
                noteBlock={childNoteBlock}
                isLast={noteBlock.childBlockRefs.length - 1 === i}
              />
            ))}
          </View>
        )}
      </View>
    );
  }
);
