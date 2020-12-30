import {
  CurrentFocusedBlockContext,
  useFocusedBlock,
} from '@harika/harika-utils';
import React, { useCallback } from 'react';
import { StyleSheet, Keyboard, Animated } from 'react-native';
import { t } from 'react-native-tailwindcss';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useContextSelector } from 'use-context-selector';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

const styles = StyleSheet.create({
  toolbar: {
    ...t.flex,
    ...t.flexRow,
    ...t.justifyAround,
    ...t.itemsStart,
    ...t.absolute,
    ...t.bottom0,
    ...t.wFull,
    ...t.bgGreen500,
  },
});

export const Toolbar = () => {
  const currentBlock = useFocusedBlock()?.noteBlock;
  const paddingBottom = useKeyboardHeight(40);

  const setEditState = useContextSelector(
    CurrentFocusedBlockContext,
    ([, setEditState]) => setEditState
  );

  const handleNewBlockPress = useCallback(async () => {
    if (!currentBlock) return;

    const newBlock = currentBlock.injectNewRightBlock('');

    if (!newBlock) return;

    setEditState({
      noteBlock: newBlock,
    });
  }, [currentBlock, setEditState]);

  const handleMoveUpPress = useCallback(async () => {
    if (!currentBlock) return;

    currentBlock.tryMoveUp();
  }, [currentBlock]);

  const handleMoveDownPress = useCallback(async () => {
    if (!currentBlock) return;

    currentBlock.tryMoveDown();
  }, [currentBlock]);

  const handleMoveLeft = useCallback(async () => {
    if (!currentBlock) return;

    currentBlock.tryMoveLeft();
  }, [currentBlock]);

  const handleMoveRight = useCallback(async () => {
    if (!currentBlock) return;

    currentBlock.tryMoveRight();
  }, [currentBlock]);

  return (
    <Animated.View style={[styles.toolbar, { paddingBottom }]}>
      <MaterialIcon.Button
        name="keyboard-hide"
        size={30}
        backgroundColor="transparent"
        onPress={Keyboard.dismiss}
      ></MaterialIcon.Button>
      <MaterialCommunityIcons.Button
        name="arrow-collapse-up"
        size={30}
        backgroundColor="transparent"
        onPress={handleMoveLeft}
      ></MaterialCommunityIcons.Button>
      <MaterialCommunityIcons.Button
        name="arrow-collapse-down"
        size={30}
        backgroundColor="transparent"
        onPress={handleMoveRight}
      ></MaterialCommunityIcons.Button>
      <MaterialCommunityIcons.Button
        name="arrow-collapse-left"
        size={30}
        backgroundColor="transparent"
        onPress={handleMoveDownPress}
      ></MaterialCommunityIcons.Button>
      <MaterialCommunityIcons.Button
        name="arrow-collapse-right"
        size={30}
        backgroundColor="transparent"
        onPress={handleMoveUpPress}
      ></MaterialCommunityIcons.Button>
      <MaterialCommunityIcons.Button
        name="plus"
        size={30}
        backgroundColor="transparent"
        onPress={handleNewBlockPress}
      ></MaterialCommunityIcons.Button>
    </Animated.View>
  );
};
