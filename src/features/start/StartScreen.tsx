import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GKButton } from '../../ui/components';
import { colors, font, spacing } from '../../ui/theme';
import { useGameStore } from '../../state/gameStore';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Start-Screen (Kapitel 2.3, Schritt 2): Spiel-Logo groß im Zentrum plus
 * "Click to Start" – rein statische Einstiegsseite ohne Funktionslogik.
 * Nach dem Tap: Ersteinstieg → Onboarding, sonst direkt ins Spiel.
 */
export function StartScreen({ navigation }: RootScreenProps<'Start'>) {
  const onboarded = useGameStore((s) => s.onboarded);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Text style={styles.logo}>⚽</Text>
        <Text style={styles.title}>GEO-KICK</Text>
        <Text style={styles.subtitle}>Echt kicken. Virtuell aufsteigen.</Text>
      </View>
      <GKButton
        title="Click to Start"
        variant="secondary"
        style={styles.button}
        onPress={() => navigation.replace(onboarded ? 'Main' : 'Onboarding')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pitch,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: spacing.xl,
  },
  logoWrap: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 110,
  },
  title: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.grass,
    fontSize: font.h2,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  button: {
    alignSelf: 'stretch',
  },
});
