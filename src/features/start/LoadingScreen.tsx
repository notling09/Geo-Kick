import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { IconBall } from '../../ui/icons';
import { colors, font, spacing } from '../../ui/theme';

/**
 * Loading screen (chapter 2.3, step 1): short splash while local data is
 * loading. Placeholder logo until the user provides the designed app icon.
 */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <IconBall color="#FFFFFF" size={84} />
      <Text style={styles.title}>GEO-KICK</Text>
      <ActivityIndicator size="large" color="#fff" style={{ marginTop: spacing.lg }} />
      <Text style={styles.hint}>Loading local data …</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pitchDark,
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
    color: colors.pitchLight,
    marginTop: spacing.md,
    fontSize: font.body,
  },
});
