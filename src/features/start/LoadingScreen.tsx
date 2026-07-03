import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../../ui/theme';

/**
 * Loading screen (chapter 2.3, step 1): short splash with the app icon
 * while local data is loading.
 */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/images/icon-transparent.png')}
        style={{ width: 140, height: 140 }}
        resizeMode="contain"
      />
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
