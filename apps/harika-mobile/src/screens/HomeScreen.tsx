import React, { useEffect, useState } from 'react';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { getOrCreateDailyNote } from '@harika/harika-notes';
import { Note as NoteModel } from '@harika/harika-notes';
import dayjs from 'dayjs';
import { Note } from '../components/Note/Note';
import { Toolbar } from '../components/Toolbar';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  View,
  Text,
} from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { t } from 'react-native-tailwindcss';

export const HomeScreen = () => {
  const database = useDatabase();
  const [note, setNote] = useState<NoteModel | null>(null);

  const paddingBottom = useKeyboardHeight(0, 120);

  useEffect(() => {
    const toExecute = async () => {
      const note = await getOrCreateDailyNote(database, dayjs());

      setNote(note);
    };

    toExecute();
  }, [database]);

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
