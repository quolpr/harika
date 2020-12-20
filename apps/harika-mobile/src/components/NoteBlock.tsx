import { CurrentFocusedBlockContext } from '@harika/harika-core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { t } from 'react-native-tailwindcss';
import {
  TextInput,
  View,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { NoteBlockModel } from '@harika/harika-notes';
import { observer } from 'mobx-react-lite';
import { Ref } from 'mobx-keystone';

const styles = StyleSheet.create({
  main: { ...t.flex, ...t.pT3, ...t.pL2 },
  body: { ...t.flex, ...t.flexRow },
  dot: {
    ...t.selfStart,
    ...t.roundedFull,
    ...t.bgGreen500,
    ...t.mR1,
    marginTop: 8,
    width: 7,
    height: 7,
    marginLeft: -3,
  },
  input: {
    ...t.hFull,
    ...t.pT0,
    ...t.textBase,
    ...t.flex,
    ...t.flexWrap,
  },
  childBlocks: {
    ...t.borderL,
    ...t.borderGreen500,
    ...t.pL4,
    ...t.mT3,
  },
  text: {
    ...t.hFull,
    ...t.wFull,
    ...t.textBase,
    ...t.hAuto,
    ...t.flex,
    ...t.flexWrap,
  },
  content: {
    ...t.mL2,
    ...t.flexRow,
  },
});

const NoteBlockChildren = observer(
  ({ childBlockRefs }: { childBlockRefs: Ref<NoteBlockModel>[] }) => {
    return childBlockRefs.length !== 0 ? (
      <View style={styles.childBlocks}>
        {childBlockRefs.map(({ current: childNoteBlock }, i) => (
          <NoteBlock
            key={childNoteBlock.$modelId}
            noteBlock={childNoteBlock}
            isLast={childBlockRefs.length - 1 === i}
            isFirst={i === 0}
          />
        ))}
      </View>
    ) : null;
  }
);

export const NoteBlock = observer(
  ({
    noteBlock,
    isLast,
    isFirst,
  }: {
    noteBlock: NoteBlockModel;
    isLast: boolean;
    isFirst: boolean;
  }) => {
    const [inputWidth, setInputWidth] = useState(0);

    const screenWidth = Dimensions.get('window').width;

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

    // useEffect(() => {
    //   if (!isEditing) {
    //     setNoteBlockContent({
    //       content: noteBlock.content,
    //       id: noteBlock.$modelId,
    //     });
    //   }
    // }, [isEditing, noteBlock.$modelId, noteBlock.content]);

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

    const handlePress = useCallback(() => {
      setFocusedBlock({ noteBlock: noteBlock });
    }, [noteBlock, setFocusedBlock]);

    const handeRef = useCallback((el: TextInput | null) => {
      if (!el) return;

      // if (isEditing && !el.isFocused()) {
      //   console.log('focus!');
      if (!el.isFocused()) {
        console.log('set el and focus');
        el.focus();
      }
      // }
    }, []);

    const handleLayout = useCallback(
      (e: LayoutChangeEvent) => {
        const pading = e.nativeEvent.layout.x;

        console.log(pading);

        setInputWidth(Dimensions.get('window').width - pading);

        console.log(Dimensions.get('window').width - pading);
      },
      [screenWidth]
    );

    const handeContentRef = useCallback((el: View) => {
      if (!el) return;
      el.measure((width, height, px, py, fx, fy) => {
        setInputWidth(Dimensions.get('window').width - fx - 40);
      });
    }, []);

    return (
      <View style={[styles.main, isLast && t.pB0, isFirst && t.pT0]}>
        <TouchableWithoutFeedback onPress={handlePress}>
          <View style={styles.body}>
            <View style={styles.dot} />
            <View style={styles.content} ref={handeContentRef}>
              {isEditing ? (
                <TextInput
                  multiline={true}
                  style={[styles.input, { width: inputWidth - 50 }]}
                  value={noteBlockContent.content}
                  onChangeText={handleChange}
                  ref={handeRef}
                />
              ) : (
                <Text style={[styles.text, { width: inputWidth - 50 }]}>
                  {noteBlockContent.content}
                </Text>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
        <NoteBlockChildren childBlockRefs={noteBlock.childBlockRefs} />
      </View>
    );
  }
);
