import React, { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GKButton } from '../../ui/components';
import { IconBall } from '../../ui/icons';
import { PitchBackground } from '../../ui/PitchBackground';
import { colors, font, radius, spacing } from '../../ui/theme';
import { useGameStore } from '../../state/gameStore';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Start screen (chapter 2.3, step 2): the game logo centered over a drawn
 * football pitch background plus a "Click to Start" button - a purely
 * static entry page. After the tap: onboarding on first launch, otherwise
 * straight into the game.
 */
export function StartScreen({ navigation }: RootScreenProps<'Start'>) {
  const onboarded = useGameStore((s) => s.onboarded);
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <PitchBackground width={width} height={height} variant="deep" />
      </View>
      <View style={styles.overlay}>
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <IconBall color="#FFFFFF" size={96} />
          </View>
          <Text style={styles.title}>GEO-KICK</Text>
          <Text style={styles.subtitle}>Play for real. Rise virtually.</Text>
        </View>
        <GKButton
          title="Click to Start"
          variant="secondary"
          style={styles.button}
          onPress={() => navigation.replace(onboarded ? 'Main' : 'Onboarding')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pitchDark,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: spacing.xl,
  },
  logoWrap: {
    alignItems: 'center',
  },
  logoBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radius.round,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  title: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
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
