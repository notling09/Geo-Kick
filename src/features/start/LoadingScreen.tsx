import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../../ui/theme';

/**
 * Loading-Screen (Kapitel 2.3, Schritt 1): kurzer Ladebildschirm, während
 * die lokalen Daten geladen werden. Platzhalter-Logo, bis das vom Nutzer
 * gestaltete App-Icon bereitgestellt wird.
 */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>⚽</Text>
      <Text style={styles.title}>GEO-KICK</Text>
      <ActivityIndicator size="large" color="#fff" style={{ marginTop: spacing.lg }} />
      <Text style={styles.hint}>Lade lokale Daten …</Text>
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
  logo: {
    fontSize: 72,
  },
  title: {
    color: '#fff',
    fontSize: font.title,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.pitchLight,
    marginTop: spacing.md,
    fontSize: font.body,
  },
});
