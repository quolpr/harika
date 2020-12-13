import {
  useTable,
  CurrentFocusedBlockContext,
  useTrackOrder,
} from '@harika/harika-core';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { t } from 'react-native-tailwindcss';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import useUpdate from 'react-use/lib/useUpdate';
import usePrevious from 'react-use/lib/usePrevious';

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

// TODO: why react memo doesnt work
export const NoteBlock = ({
  noteBlock,
  onOrderChange,
  isLast,
}: {
  noteBlock: NoteBlockModel;
  onOrderChange: () => void;
  isLast: boolean;
}) => {
  const database = useDatabase();
  const update = useUpdate();

  noteBlock = useTable(noteBlock);
  const childBlocks = useTable(noteBlock.childBlocks);

  const inputRef = useRef<TextInput | null>(null);

  const [noteBlockContent, setNoteBlockContent] = useState({
    content: noteBlock.content,
    id: noteBlock.id,
  });

  const setFocusedBlock = useContextSelector(
    CurrentFocusedBlockContext,
    ([, setEditState]) => setEditState
  );
  const isEditing = useContextSelector(
    CurrentFocusedBlockContext,
    ([editState]) => editState?.id === noteBlock.id
  );
  const startPositionAt = useContextSelector(
    CurrentFocusedBlockContext,
    ([editState]) =>
      editState?.id === noteBlock.id && editState?.startPositionAt
        ? editState.startPositionAt
        : undefined
  );

  const prevContentValue = usePrevious(noteBlock.content);

  useEffect(() => {
    if (!isEditing) {
      setNoteBlockContent({ content: noteBlock.content, id: noteBlock.id });
    }
  }, [isEditing, noteBlock.id, noteBlock.content]);

  useEffect(() => {
    if (!inputRef.current) return;

    if (isEditing && !inputRef.current.isFocused()) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleFocus = useCallback(() => {
    setFocusedBlock({ id: noteBlock.id });
  }, [noteBlock.id, setFocusedBlock]);

  useEffect(() => {
    if (noteBlock.id !== noteBlockContent.id) return;
    if (noteBlock.content === noteBlockContent.content) return;

    database.action(async () => {
      await noteBlock.update((post) => {
        post.content = noteBlockContent.content;
      });
    });
  }, [database, noteBlock, noteBlockContent.content, noteBlockContent.id]);

  const handleChange = useCallback(
    (value: string) => {
      setNoteBlockContent({ content: value, id: noteBlock.id });
    },
    [noteBlock.id]
  );

  useTrackOrder(noteBlock, onOrderChange);

  return (
    <View style={[styles.main, isLast && t.pB0]}>
      <View style={styles.body}>
        <View style={styles.dot} />
        <Text>{noteBlock.order}</Text>
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
      {childBlocks.length !== 0 && (
        <View style={styles.childBlocks}>
          {NoteBlockModel.sort(childBlocks).map((childNoteBlock, i) => (
            <NoteBlock
              onOrderChange={update}
              key={childNoteBlock.id}
              noteBlock={childNoteBlock}
              isLast={childBlocks.length - 1 === i}
            />
          ))}
        </View>
      )}
    </View>
  );
};
