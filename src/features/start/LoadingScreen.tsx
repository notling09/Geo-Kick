import React from 'react';
import {
  ActivityIndicator, Image, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { PitchBackground } from '../../ui/PitchBackground';
import { font, spacing } from '../../ui/theme';

/**
 * Loading screen (chapter 2.3, step 1): short splash with the app icon
 * while local data is loading. With errorText it doubles as the startup
 * error screen (instead of hanging forever).
 */
export function LoadingScreen({ errorText }: { errorText?: string }) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <PitchBackground width={width} height={height} />
      </View>
      <Image
        source={require('../../../assets/images/icon-transparent.png')}
        style={{ width: 140, height: 140 }}
        resizeMode="contain"
      />
      <Text style={styles.title}>GEO-KICK</Text>
      {errorText ? (
        <Text style={styles.error}>{errorText}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: spacing.lg }} />
          <Text style={styles.hint}>Loading local data …</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Gleiches Rasen-Grün wie der native Splash (app.json), nahtloser
    // Übergang; darüber die gezeichneten Feldlinien (PitchBackground)
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: font.title,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: spacing.md,
  },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.md,
    fontSize: font.body,
  },
  error: {
    color: '#FFE082',
    marginTop: spacing.md,
    fontSize: font.small,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
