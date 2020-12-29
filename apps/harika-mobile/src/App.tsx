import 'react-native-get-random-values';
import React, { useCallback, useState } from 'react';
// @ts-ignore
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { HarikaNotes, schema } from '@harika/harika-notes';
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { HomeScreen } from './screens/HomeScreen';
import {
  CurrentFocusedBlockContext,
  CurrentNoteContext,
  HarikaStoreContext,
  ICurrentFocusedBlockState,
  ICurrentNoteState,
  useHarikaStore,
} from '@harika/harika-core';
import 'react-native-console-time-polyfill';
import { Text, View } from 'react-native';
import { t } from 'react-native-tailwindcss';
import { Calendar, CalendarList, Agenda } from 'react-native-calendars';
import { useEffect } from 'react';

// First, create the adapter to the underlying database:
const adapter = new SQLiteAdapter({
  schema: schema,
  // dbName: 'myapp', // optional database name or file system path
  // migrations, // optional migrations
  synchronous: true, // synchronous mode only works on iOS. improves performance and reduces glitches in most cases, but also has some downsides - test with and without it
  // experimentalUseJSI: true, // experimental JSI mode, use only if you're brave
} as any);

// <StatusBar barStyle="dark-content" />
// <SafeAreaView>
//   <ScrollView
//     contentInsetAdjustmentBehavior="automatic"
//     style={styles.scrollView}
//   >
//     <View style={styles.header}>
//       <Image style={styles.logo} source={require('./logo.png')} />
//       <Text style={styles.heading} testID="heading">
//         Welcome to React Native
//       </Text>
//     </View>
//     <View style={styles.body}>
//       <View style={styles.sectionContainer}>
//         <Text style={styles.sectionTitle}>Step Ones</Text>
//         <Text style={styles.sectionDescription}>
//           Edit{' '}
//           <Text style={styles.highlight}>
//             apps/harika-mobile/App.tsx
//           </Text>{' '}
//           to change this screen and then come back to see your edits.
//         </Text>
//       </View>
//       <View style={styles.sectionContainer}>
//         <Text style={styles.sectionTitle}>See Your Changes</Text>
//         <Text style={styles.sectionDescription}>
//           <ReloadInstructions /> Alternatively, press{' '}
//           <Text style={styles.highlight}>R</Text> in the bundler
//           terminal window.
//         </Text>
//       </View>
//       <View style={styles.sectionContainer}>
//         <Text style={styles.sectionTitle}>Debug</Text>
//         <Text style={styles.sectionDescription}>
//           <DebugInstructions />
//         </Text>
//       </View>
//       <View style={styles.sectionContainer}>
//         <Text style={styles.sectionTitle}>Learn More</Text>
//         <TouchableOpacity
//           accessibilityRole="button"
//           onPress={() => openURLInBrowser('https://nx.dev')}
//         >
//           <Text style={styles.sectionDescription}>
//             Visit <Text style={styles.link}>nx.dev</Text> for more
//             info about Nx.
//           </Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   </ScrollView>
// </SafeAreaView>

const harikaNotes = new HarikaNotes(adapter);

const Stack = createStackNavigator();

const Syncher: React.FC = ({ children }) => {
  const store = useHarikaStore();
  const [wasSynched, setWasSynched] = useState(false);

  useEffect(() => {
    const callback = async () => {
      await store.sync();

      setWasSynched(true);
    };

    callback();
  }, [store]);

  return <>{wasSynched && children}</>;
};

const App: React.FC = () => {
  const stateActions = useState<ICurrentFocusedBlockState>();
  const currentNoteActions = useState<ICurrentNoteState>();

  const [isCalendarOpened, setIsCalendarOpened] = useState(false);

  const renderRightHeader = useCallback(() => {
    return (
      <View>
        <Text
          style={t.mR4}
          onPress={() => {
            setIsCalendarOpened(!isCalendarOpened);
          }}
        >
          Calendar
        </Text>
      </View>
    );
  }, [isCalendarOpened]);

  return (
    <HarikaStoreContext.Provider value={harikaNotes}>
      <CurrentNoteContext.Provider value={currentNoteActions}>
        <CurrentFocusedBlockContext.Provider value={stateActions}>
          <Syncher>
            <NavigationContainer>
              <Stack.Navigator>
                <Stack.Screen
                  name="Home"
                  options={{
                    title: 'Daily Note',
                    headerRight: renderRightHeader,
                  }}
                >
                  {(props) => (
                    <HomeScreen
                      {...props}
                      isCalendarOpened={isCalendarOpened}
                      setIsCalendarOpened={setIsCalendarOpened}
                    />
                  )}
                </Stack.Screen>
              </Stack.Navigator>
            </NavigationContainer>
          </Syncher>
        </CurrentFocusedBlockContext.Provider>
      </CurrentNoteContext.Provider>
    </HarikaStoreContext.Provider>
  );
};

// const styles = StyleSheet.create({
//   scrollView: {
//     backgroundColor: Colors.lighter,
//   },
//   header: {
//     backgroundColor: '#143055',
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 24,
//   },
//   logo: {
//     width: 200,
//     height: 180,
//     resizeMode: 'contain',
//   },
//   heading: {
//     fontSize: 24,
//     fontWeight: '600',
//     color: Colors.lighter,
//   },
//   body: {
//     backgroundColor: Colors.white,
//   },
//   sectionContainer: {
//     marginTop: 32,
//     paddingHorizontal: 24,
//   },
//   sectionTitle: {
//     fontSize: 24,
//     fontWeight: '600',
//     color: Colors.black,
//   },
//   sectionDescription: {
//     marginTop: 8,
//     fontSize: 18,
//     fontWeight: '400',
//     color: Colors.dark,
//   },
//   highlight: {
//     fontWeight: '700',
//   },
//   footer: {
//     color: Colors.dark,
//     fontSize: 12,
//     fontWeight: '600',
//     padding: 4,
//     paddingRight: 12,
//     textAlign: 'right',
//   },
//   link: {
//     color: '#45bc98',
//   },
// });

export default App;
