import React, { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Note } from '../components/Note/Note';
import { Toolbar } from '../components/Toolbar';
import { Animated, SafeAreaView, TouchableOpacity } from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { NoteModel } from '@harika/harika-core';
import { t } from 'react-native-tailwindcss';
import { CalendarList } from 'react-native-calendars';
import { useCurrentVault } from '@harika/harika-utils';

export const HomeScreen = React.memo(
  ({
    isCalendarOpened,
    setIsCalendarOpened,
  }: {
    isCalendarOpened: boolean;
    setIsCalendarOpened: (flag: boolean) => void;
  }) => {
    const animatedHeight = useRef(new Animated.Value(-330)).current;
    const vault = useCurrentVault();
    const [note, setNote] = useState<NoteModel | null>(null);

    const paddingBottom = useKeyboardHeight(0, 120);

    useEffect(() => {
      const toExecute = async () => {
        const note = await vault.getOrCreateDailyNote(dayjs());

        setNote(note);
      };

      toExecute();
    }, [vault]);

    if (note) {
      console.log(dayjs(note.dailyNoteDate).format('YYYY-MM-DD'));
    }

    useEffect(() => {
      if (isCalendarOpened) {
        Animated.spring(animatedHeight, {
          toValue: -20,
          useNativeDriver: false,
        }).start();
      } else {
        Animated.spring(animatedHeight, {
          toValue: -330,
          useNativeDriver: false,
        }).start();
      }
    }, [isCalendarOpened, animatedHeight]);

    return (
      note && (
        <>
          {isCalendarOpened && (
            <TouchableOpacity
              style={{
                position: 'absolute',
                zIndex: 99,
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
              }}
              onPress={() => setIsCalendarOpened(false)}
            />
          )}
          <Animated.View
            style={{
              position: 'absolute',
              width: '100%',
              zIndex: 100,
              height: 330,
              top: animatedHeight,
            }}
          >
            <CalendarList
              current={dayjs(note.dailyNoteDate).format('YYYY-MM-DD')}
              // Max amount of months allowed to scroll to the past. Default = 50
              pastScrollRange={50}
              // Max amount of months allowed to scroll to the future. Default = 50
              futureScrollRange={50}
              // Enable or disable scrolling of calendar list
              scrollEnabled={true}
              // Enable or disable vertical scroll indicator. Default = false
              showScrollIndicator={true}
              style={{
                width: '100%',
                paddingTop: 20,
              }}
              markedDates={{
                [dayjs(note.dailyNoteDate).format('YYYY-MM-DD')]: {
                  selected: true,
                },
              }}
              onDayPress={async (date) => {
                const note = await vault.getOrCreateDailyNote(
                  dayjs.unix(date.timestamp / 1000)
                );

                setNote(note);

                setIsCalendarOpened(false);
              }}
            />
          </Animated.View>
          <SafeAreaView>
            <Animated.ScrollView keyboardShouldPersistTaps="handled">
              <Animated.View style={{ paddingBottom, ...t.p4 }}>
                <Note note={note} />
              </Animated.View>
            </Animated.ScrollView>
          </SafeAreaView>
          <Toolbar />
        </>
      )
    );
  }
);
