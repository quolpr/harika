import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Note } from '../components/Note/Note';
import { Toolbar } from '../components/Toolbar';
import { Animated, SafeAreaView } from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useHarikaStore } from '@harika/harika-core';
import { NoteModel } from '@harika/harika-notes';

export const HomeScreen = () => {
  const store = useHarikaStore();
  const [note, setNote] = useState<NoteModel | null>(null);

  const paddingBottom = useKeyboardHeight(0, 120);

  useEffect(() => {
    const toExecute = async () => {
      const note = await store.getOrCreateDailyNote(dayjs());

      setNote(note);
    };

    toExecute();
  }, [store]);

  return (
    note && (
      <>
        <SafeAreaView>
          <Animated.ScrollView>
            <Animated.View style={{ paddingBottom }}>
              <Note note={note} />
            </Animated.View>
          </Animated.ScrollView>
        </SafeAreaView>
        <Toolbar />
      </>
    )
  );
};
