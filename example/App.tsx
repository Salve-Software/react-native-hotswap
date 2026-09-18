import React from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import NativeProbe from './probe/src/NativeProbe';

const TARGETS = [
  ['Kotlin', 'probe/android/src/main/java/com/probe/ProbeValues.kt'],
  ['Swift', 'probe/ios/ProbeValues.swift'],
  ['C++', 'probe/cpp/probe.cpp'],
  ['C++ header', 'probe/cpp/probe.hpp'],
];

function App(): React.JSX.Element {
  const origin =
    Platform.OS === 'ios' ? (NativeProbe?.origin() ?? 'no module') : 'android';

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>react-native-hotswap</Text>
      <Text style={styles.body}>
        The probe reports every second. Watch it with:
      </Text>
      <Text style={styles.code}>adb logcat -s Probe</Text>
      <Text style={styles.code}>
        xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS
        "[Probe]"'
      </Text>
      <Text style={styles.body}>Probe module comes from: {origin}</Text>
      <Text style={styles.body}>Edit any of these and save:</Text>
      {TARGETS.map(([language, path]) => (
        <View key={path} style={styles.row}>
          <Text style={styles.language}>{language}</Text>
          <Text style={styles.path}>{path}</Text>
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  body: { fontSize: 15, marginTop: 8 },
  code: { fontFamily: 'Menlo', fontSize: 11, opacity: 0.7 },
  row: { gap: 2 },
  language: { fontSize: 13, fontWeight: '600' },
  path: { fontFamily: 'Menlo', fontSize: 11, opacity: 0.7 },
});

export default App;
